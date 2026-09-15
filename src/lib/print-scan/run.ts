'use client';

import { generateDraft } from '@/lib/ai/codex/generateDraft';
import { AiError } from '@/lib/ai/types';
import { registerBundleWords } from '@/lib/print-words/register';
import { probePageOrientation, type PageOrientation } from '@/lib/page-orientation';
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
import { bundleWordsCategory } from './bundle-plan';
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
  /**
   * 미리 확인해 둔 쪽 방향. 없으면 이 묶음의 쪽만 여기서 확인한다.
   *
   * 스캔 전체를 한 번에 확인한 값을 넘기는 쪽이 싸다 — 여러 묶음이 같은 문서를 나눠 쓴다.
   */
  orientation?: PageOrientation;
}

export interface PrintRunProgress {
  phase: 'upload' | 'orient' | 'page' | 'ocr' | 'save' | 'words';
  done: number;
  total: number;
  /** 여러 묶음을 이어 읽을 때 지금 몇 번째인지 */
  bundle?: { index: number; total: number; name: string };
}

/** 묶음 하나를 끝까지 처리한 결과 */
export interface PrintBundleRunResult {
  /** 만들어진(또는 이미 있던) 시험지 id */
  sheetId: string;
  /** 이 묶음에서 등록된 단어 수 (안 켰거나 못 했으면 0) */
  wordsRegistered: number;
  /**
   * 단어 단계가 **다음 묶음도 같은 이유로 죽을** 오류로 끝났는가(취소·한도·권한).
   * 호출자가 이어 읽기를 멈추는 데 쓴다. 이 값이 있어도 이 묶음의 시험지는 멀쩡하다.
   */
  wordsFatal: AiError | null;
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
  orientation?: PageOrientation,
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
      signal: env.signal,
      splitColumns: OCR_SPLIT_COLUMNS,
      // 거꾸로 스캔된 쪽은 바로 세워 보낸다 — 뒤집힌 채 보내면 본문이 통째로 빈 채 돌아온다
      rotations: orientation?.rotations,
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
    ...unreadablePageWarnings(drafts, orientation),
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
 * 글자가 있는데 본문이 비어 돌아온 쪽을 경고로 만든다.
 *
 * ⚠️ 프롬프트가 "읽을 내용이 없는 쪽도 html 을 빈 문자열로" 라고 시키므로, **빈 본문은
 *    스스로는 오류가 아니다.** 그래서 거꾸로 스캔돼 한 글자도 못 읽은 쪽이 경고 하나 없이
 *    빈 시험지가 되고 화면은 "다 됐어요" 라고 말했다. 방향 판정이 '글자가 있다' 고 본 쪽만
 *    짚는다 — 빈 뒷면·간지까지 경고하면 경고 전체를 안 믿게 된다.
 * @param drafts - 배치별 읽기 결과
 * @param orientation - 방향 판정 결과 (없으면 아무것도 짚지 않는다)
 * @returns 경고 문구들
 */
function unreadablePageWarnings(
  drafts: readonly PrintOcrDraft[],
  orientation?: PageOrientation,
): string[] {
  if (!orientation) return [];
  const out: string[] = [];
  const said = new Set<number>();
  for (const draft of drafts) {
    for (const page of draft.pages) {
      // 모델이 아예 안 낸 쪽은 파서가 이미 경고했다 — 또 하면 같은 쪽 얘기가 두 번 나간다
      if (page.missing) continue;
      if (said.has(page.page)) continue;
      if (orientation.blankPages.has(page.page)) continue;
      // ⚠️ 문자열이 비었는지가 아니라 **보이는 글자**가 있는지를 본다.
      //    빈 줄을 `<p></p>` 로 옮기라고 시켰으므로 그것만 든 쪽은 빈 쪽이다
      if (visibleText(page.html) !== '') continue;
      said.add(page.page);
      out.push(`${page.page}쪽에서 글을 하나도 읽지 못했어요. 원본을 확인해 주세요.`);
    }
  }
  return out;
}

/**
 * 태그를 걷어낸 보이는 글자.
 * @param html - 읽어 낸 쪽 HTML
 * @returns 글자만 남긴 값 (없으면 빈 문자열)
 */
function visibleText(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    // 공백 엔티티는 이름으로도 숫자로도 온다 — 안 풀면 공백만 든 쪽이 '글이 있다' 가 된다
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(?:160|32);/g, ' ')
    .replace(/&#x(?:a0|20);/gi, ' ')
    .trim();
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
 * @returns 시험지 id 와 단어 등록 결과
 * @throws AiError - 멈춰야 하는 오류(취소·한도·권한)일 때만 다시 던진다
 */
export async function runBundle(
  bundle: PrintBundle,
  doc: OpenPdf,
  env: PrintRunEnv,
): Promise<PrintBundleRunResult> {
  await updateBundle(bundle.id, { status: '읽는중' });
  let sheetId: string;
  let html: string;
  try {
    // 읽기 전에 종이를 바로 세운다. 스캔 전체를 한 번에 확인한 값이 있으면 그것을 쓴다
    const orientation = env.orientation ?? await probePageOrientation(doc, bundle.pages, {
      port: env.port,
      pref: env.pref,
      signal: env.signal,
      onProgress: (done, total) => env.onProgress?.({ phase: 'orient', done, total }),
    });
    const read = await readBundle(bundle, doc, env, orientation);
    html = read.html;
    const meta = read.meta;

    // 저장보다 **먼저** 알린다 — 뒤에서 저장이 실패해도 무엇이 모자랐는지는 남아야 한다
    if (meta.warnings && meta.warnings.length > 0) env.onWarnings?.(meta.warnings);

    env.onProgress?.({ phase: 'save', done: 0, total: 1 });
    sheetId = await createSheetForBundle(bundle, html);
    // 카테고리 트리에도 올려 둔다(실패해도 시험지는 멀쩡하다).
    // 못 올렸으면 **말한다** — 시험지는 멀쩡한데 트리에서만 안 보이는 것이 가장 찾기 어렵다
    await ensureSchoolMaterial(bundle, (warning) => env.onWarnings?.([warning]));

    await updateBundle(bundle.id, {
      status: '읽기완료',
      ocr_html: html,
      ocr_meta: meta,
      page_paths: bundle.page_paths,
    });
    env.onProgress?.({ phase: 'save', done: 1, total: 1 });
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

  // ⚠️ 단어 등록은 **위 try/catch 바깥**이다. 시험지는 이미 저장됐고 상태도 '읽기완료' 라,
  //    여기서 무슨 일이 나도 묶음을 '실패' 로 되돌리면 안 된다 — 멀쩡한 시험지가 실패로 보인다.
  //    (`registerBundleWords` 는 던지지 않고 영수증·경고로만 말한다.)
  const words = bundle.register_words
    ? await registerWordsForBundle(bundle, html, env)
    : null;

  return {
    sheetId,
    wordsRegistered: words?.meta.registered ?? 0,
    wordsFatal: words?.fatal ?? null,
  };
}

/**
 * 이 묶음의 단어를 등록한다.
 *
 * 카테고리와 저장 함수를 **여기서 주입한다** — `print-words` 는 묶음 표를 모르고,
 * 알게 하면 `print-scan` ↔ `print-words` 순환 import 가 된다(import-cycles 테스트가 잡는다).
 * @param bundle - 묶음
 * @param html - 읽어 낸 본문
 * @param env - 읽기 환경
 * @returns 영수증과 치명 오류
 */
async function registerWordsForBundle(
  bundle: PrintBundle,
  html: string,
  env: PrintRunEnv,
) {
  env.onProgress?.({ phase: 'words', done: 0, total: 1 });
  const result = await registerBundleWords({
    bundle,
    html,
    category: bundleWordsCategory(bundle),
    previous: bundle.words_meta,
    persist: (meta) => updateBundle(bundle.id, { words_meta: meta }),
    port: env.port,
    pref: env.pref,
    signal: env.signal,
    onWarnings: (w) => env.onWarnings?.(w),
  });
  env.onProgress?.({ phase: 'words', done: 1, total: 1 });
  return result;
}
