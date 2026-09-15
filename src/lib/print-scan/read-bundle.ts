'use client';

import { generateDraft } from '@/lib/ai/codex/generateDraft';
import { AiError } from '@/lib/ai/types';
import type { PageOrientation } from '@/lib/page-orientation';
import { DEGRADED_WARN_STEP } from '@/lib/pdf/pdfBudget';
import { renderPagesToImages, type OpenPdf } from '@/lib/pdf/pdfPages';
import { planPageBatches } from '@/lib/problem-ocr/batch-plan';
import { representativeFailure, runOcrBatches } from '@/lib/problem-ocr/batch-run';
import { OCR_SPLIT_COLUMNS, ocrTurnBudgetMs } from '@/lib/problem-ocr/constants';
import { collectPageTexts, textSourceOf, type PageText } from '@/lib/problem-ocr/page-text';
import { warningText } from '@/lib/problem-ocr/warnings';
import type { PrintBundle, PrintOcrMeta } from '@/types/print-scan';
import {
  PRINT_BATCH_OVERLAP, PRINT_MAX_MERGED_WARNINGS, PRINT_PAGES_PER_BATCH,
  PRINT_SPLIT_COLUMN_ROWS, PRINT_SPLIT_ROWS,
} from './constants';
import { finalizePrintHtml, joinPageHtml, parsePrintOcrDraft } from './parse';
import { buildPrintOcrPrompt } from './prompt';
import { degradedPagesWarning } from './quality';
import type { PrintRunEnv } from './run-env';
import { PRINT_OCR_SCHEMA, type PrintOcrDraft } from './schema';

/**
 * 묶음(= 프린트 한 장)의 쪽을 읽어 본문 HTML 을 만든다 (브라우저 전용, 저장은 하지 않는다).
 *
 * `run.ts` 에서 떼어 왔다(파일당 300줄 규칙). 그쪽은 상태 전이와 저장을 맡는다.
 */

/**
 * 묶음의 쪽을 읽어 본문 HTML 을 만든다.
 * @param bundle - 묶음
 * @param doc - 열어 둔 PDF
 * @param env - 포트·모델·취소·진행률
 * @param orientation - 미리 확인해 둔 쪽 방향
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
  // 본문 읽기는 **해석이 끝난 모델·노력**으로 부른다(없으면 선생님 선택 그대로).
  // ⚠️ 방향 판정은 이 값을 쓰지 않는다 — 작은 이미지로 각도만 묻는 싼 단계다
  const turnPref = env.ocrPref ?? env.pref;
  // 화질을 낮춰 보낸 쪽(과 그 정도)·글자 레이어를 쓴 쪽. **Map/Set 인 까닭**: 실패한 묶음은
  // 쪽을 쪼개 다시 렌더하므로 같은 쪽이 두 번 온다 — 그때 **더 나쁜 쪽**을 남긴다
  const degraded = new Map<number, number>();
  const withText = new Set<number>();

  const run = await runOcrBatches<PrintOcrDraft>({
    batches,
    // 2단으로 짜인 프린트는 단별로 갈라 보낸다 — 읽을 순서가 하나뿐이라 두 단이 섞이지 않고,
    // 같은 용량이 절반의 넓이에 쓰여 글자가 커진다
    renderBatch: async (pages) => {
      const out = await renderPagesToImages(doc, pages, {
        signal: env.signal,
        splitColumns: OCR_SPLIT_COLUMNS,
        // 1단 쪽은 빈 줄에서 위·아래로 가른다 — 글자가 더 큰 화소로 보인다(rowDetect.ts).
        // ⚠️ 기출은 켜지 않는다: 세로를 자르면 그림 크롭 좌표가 어긋난다
        splitRows: PRINT_SPLIT_ROWS,
        splitColumnRows: PRINT_SPLIT_COLUMN_ROWS,
        // 거꾸로 스캔된 쪽은 바로 세워 보낸다 — 뒤집힌 채 보내면 본문이 통째로 빈 채 돌아온다
        rotations: orientation?.rotations,
      });
      for (const { page, step } of out.degraded ?? []) {
        degraded.set(page, Math.max(degraded.get(page) ?? 0, step));
      }
      return out;
    },
    runBatch: async ({ pages, rendered, images, index, total }) => {
      // PDF 에 글자가 박혀 있으면 함께 보낸다 — 글자 하나하나는 그쪽이 정확하다.
      // 스캔본에는 없는 게 정상이라, 없다고 읽기를 멈추지 않는다
      const pageTexts: PageText[] = await collectPageTexts(doc, pages);
      for (const t of pageTexts) withText.add(t.page);
      const raw = await generateDraft({
        port: env.port,
        prompt: buildPrintOcrPrompt({
          bundle, pages, rendered, pageTexts, batch: { index, total },
        }),
        outputSchema: PRINT_OCR_SCHEMA,
        model: turnPref.model,
        effort: turnPref.effort,
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
  // 끝내 못 읽은 쪽까지 '화질을 낮췄다' 고 하면 엉뚱한 데를 보게 된다 — **읽힌 쪽만** 짚는다
  const read = new Set(run.drafts.flatMap((d) => d.pages));
  const lowered = [...degraded].filter(([page]) => read.has(page)).sort((a, b) => a[0] - b[0]);
  // 기록에는 한 칸이라도 낮춘 쪽을 다 남기고, **경고는 심하게 낮춘 쪽만** 한다 —
  // 한 칸은 큰 스캔에서 예사로 걸려, 그걸로 '확인 필요' 를 붙이면 경고 전체를 안 믿게 된다
  const degradedPages = lowered.map(([page]) => page);
  const degradedWarning = degradedPagesWarning(
    lowered.filter(([, step]) => step >= DEGRADED_WARN_STEP).map(([page]) => page),
  );
  const warnings = [
    ...run.warnings.map(warningText),
    ...(degradedWarning ? [degradedWarning] : []),
    ...drafts.flatMap((d) => d.warnings),
    ...unreadablePageWarnings(drafts, orientation),
  ].slice(0, PRINT_MAX_MERGED_WARNINGS);

  return {
    html: finalizePrintHtml(joinPageHtml(drafts)),
    meta: {
      model: turnPref.model,
      effort: turnPref.effort,
      pages: [...bundle.pages],
      batches: batches.length,
      retries: run.retries,
      durationMs: Date.now() - startedAt,
      imagesSent: run.imagesSent,
      ...(degradedPages.length > 0 ? { degradedPages } : {}),
      textSource: textSourceOf(bundle.pages.length, withText.size),
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
