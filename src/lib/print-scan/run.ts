'use client';

import { generateDraft } from '@/lib/ai/codex/generateDraft';
import { AiError } from '@/lib/ai/types';
import { renderPagesToImages, type OpenPdf } from '@/lib/pdf/pdfPages';
import { planPageBatches } from '@/lib/problem-ocr/batch-plan';
import { representativeFailure, runOcrBatches } from '@/lib/problem-ocr/batch-run';
import { OCR_SPLIT_COLUMNS, ocrTurnBudgetMs } from '@/lib/problem-ocr/constants';
import { warningText } from '@/lib/problem-ocr/warnings';
import type { PrintBundle, PrintOcrMeta } from '@/types/print-scan';
import { PRINT_BATCH_OVERLAP, PRINT_MAX_MERGED_WARNINGS, PRINT_PAGES_PER_BATCH } from './constants';
import { finalizePrintHtml, joinPageHtml, parsePrintOcrDraft } from './parse';
import { buildPrintOcrPrompt } from './prompt';
import { PRINT_OCR_SCHEMA, type PrintOcrDraft } from './schema';
import { createSheetForBundle, ensureSchoolMaterial, updateBundle } from './save';

/**
 * 묶음(= 프린트 한 장) 하나를 읽어 시험지로 만든다 (브라우저 전용).
 *
 * 기출 OCR(`problem-ocr/run.ts`)의 축소판이다 — 같은 묶음 실행기(`runOcrBatches`)를 쓰고
 * 실패를 다루는 규칙도 같다. 다른 점 셋:
 *   ① 결과가 지문·문항이 아니라 **평문 HTML** 이라 병합이 없다(그래서 겹쳐 읽지 않는다).
 *   ② 정답표·크롭이 없다.
 *   ③ 저장 대상이 새 표가 아니라 **개념지** 다.
 */

/** 읽기 환경 — 화면(훅)이 정한다 */
export interface PrintRunEnv {
  port: number;
  pref: { model: string | null; effort: string | null };
  signal?: AbortSignal;
  onProgress?: (p: PrintRunProgress) => void;
  /**
   * 읽기가 남긴 경고 — **완료를 알리기 전에** 부른다.
   *
   * 경고를 `ocr_meta` 에만 넣고 끝내면 화면은 "다 됐어요" 만 말한다. 쪽이 빠졌거나 본문이
   * 잘렸어도 선생님은 완성본으로 알고 그대로 인쇄한다.
   */
  onWarnings?: (warnings: string[]) => void;
}

export interface PrintRunProgress {
  phase: 'upload' | 'page' | 'ocr' | 'save';
  done: number;
  total: number;
  /** 여러 묶음을 이어 읽을 때 지금 몇 번째인지 */
  bundle?: { index: number; total: number; name: string };
}

/**
 * 묶음의 쪽을 읽어 본문 HTML 을 만든다 (저장은 하지 않는다).
 * @param bundle - 묶음
 * @param doc - 열어 둔 PDF
 * @param env - 포트·모델·취소·진행률
 * @returns 정화까지 끝난 본문과 읽기 기록
 * @throws AiError - 한 번도 못 읽었을 때
 */
export async function readBundle(
  bundle: PrintBundle,
  doc: OpenPdf,
  env: PrintRunEnv,
): Promise<{ html: string; meta: PrintOcrMeta }> {
  const startedAt = Date.now();
  const batches = planPageBatches(bundle.pages, {
    size: PRINT_PAGES_PER_BATCH,
    overlap: PRINT_BATCH_OVERLAP,
  });

  const run = await runOcrBatches<PrintOcrDraft>({
    batches,
    // 2단으로 짜인 프린트는 단별로 갈라 보낸다 — 읽을 순서가 하나뿐이라 두 단이 섞이지 않고,
    // 같은 용량이 절반의 넓이에 쓰여 글자가 커진다
    renderBatch: (pages) => renderPagesToImages(doc, pages, {
      signal: env.signal, splitColumns: OCR_SPLIT_COLUMNS,
    }),
    runBatch: async ({ pages, rendered, images, index, total }) => {
      const raw = await generateDraft({
        port: env.port,
        prompt: buildPrintOcrPrompt({
          bundle, pages, rendered, batch: { index, total },
        }),
        outputSchema: PRINT_OCR_SCHEMA,
        model: env.pref.model,
        effort: env.pref.effort,
        images,
        signal: env.signal,
        timeoutMs: ocrTurnBudgetMs(pages.length),
      });
      const draft = parsePrintOcrDraft(raw, { pages });
      if (!draft) throw new AiError('invalid_output');
      return { draft, rawLength: raw.length };
    },
    onProgress: (done, total) => env.onProgress?.({ phase: 'ocr', done, total }),
    signal: env.signal,
  });

  // 한 번도 못 읽었으면 원인을 그대로 올린다 — "빈 시험지"로 끝내면 왜인지 모른다
  if (run.drafts.length === 0) {
    const failure = representativeFailure(run);
    throw failure?.kind === 'ai' ? new AiError(failure.code) : new AiError('provider_unavailable');
  }

  const drafts = run.drafts.map((d) => d.draft);
  const warnings = [
    ...run.warnings.map(warningText),
    ...drafts.flatMap((d) => d.warnings),
  ].slice(0, PRINT_MAX_MERGED_WARNINGS);

  return {
    html: finalizePrintHtml(joinPageHtml(drafts)),
    meta: {
      model: env.pref.model,
      effort: env.pref.effort,
      pages: [...bundle.pages],
      batches: batches.length,
      retries: run.retries,
      durationMs: Date.now() - startedAt,
      imagesSent: run.imagesSent,
      warnings,
      ranAt: new Date().toISOString(),
    },
  };
}

/**
 * 묶음 하나를 읽어 **시험지까지 만든다**. 상태 전이를 책임진다.
 *
 * ⚠️ 어떤 길로 빠져나가도 **'읽는중' 으로 남기지 않는다.** 업로드가 그 상태로 만들어 두고
 *    성공 경로만 상태를 바꾸면, 실패·취소한 묶음이 **영영 돌고 있는 것처럼** 보인다
 *    (기출에서 실제로 겪은 결함이다). 다만 탭이 닫히면 이 `catch` 가 아예 못 돌아서
 *    행이 '읽는중' 으로 남는다 — 그쪽 복구는 [reading-state.ts](./reading-state.ts) 가 맡는다.
 * ⚠️ **일부만 읽힌 것을 성공으로 알리지 않는다.** 배치가 몇 개 실패하거나 본문이 잘려도
 *    살아남은 쪽으로 시험지가 만들어지므로, `onWarnings` 로 그 사실을 함께 올린다.
 *
 * @param bundle - 묶음
 * @param doc - 열어 둔 PDF
 * @param env - 읽기 환경
 * @returns 읽어서 만든 시험지 id
 * @throws AiError - 멈춰야 하는 오류(취소·한도·권한)일 때만 다시 던진다
 */
export async function runBundle(
  bundle: PrintBundle,
  doc: OpenPdf,
  env: PrintRunEnv,
): Promise<string> {
  await updateBundle(bundle.id, { status: '읽는중' });
  try {
    const { html, meta } = await readBundle(bundle, doc, env);

    // 저장보다 **먼저** 알린다 — 뒤에서 저장이 실패해도 무엇이 모자랐는지는 남아야 한다
    if (meta.warnings && meta.warnings.length > 0) env.onWarnings?.(meta.warnings);

    env.onProgress?.({ phase: 'save', done: 0, total: 1 });
    const sheetId = await createSheetForBundle(bundle, html);
    // 카테고리 트리에도 올려 둔다(실패해도 시험지는 멀쩡하다)
    await ensureSchoolMaterial(bundle);

    await updateBundle(bundle.id, {
      status: '읽기완료',
      ocr_html: html,
      ocr_meta: meta,
      page_paths: bundle.page_paths,
    });
    env.onProgress?.({ phase: 'save', done: 1, total: 1 });
    return sheetId;
  } catch (e) {
    await updateBundle(bundle.id, {
      status: '실패',
      ocr_meta: {
        pages: [...bundle.pages],
        ranAt: new Date().toISOString(),
        warnings: [
          e instanceof Error && e.message
            ? `읽기가 끝나지 못했어요: ${e.message}`
            : '읽기가 끝나지 못했어요.',
          '목록에서 다시 읽기를 누르면 올려 둔 원본으로 다시 시도합니다.',
        ],
      },
    }).catch(() => {
      // 상태 정리까지 실패하면 어쩔 수 없다 — 원래 오류를 가리지 않는다
    });
    throw e;
  }
}
