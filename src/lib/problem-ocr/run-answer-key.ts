'use client';

import { generateDraft } from '@/lib/ai/codex/generateDraft';
import { AiError } from '@/lib/ai/types';
import { imageFileToJpegDataUrl } from '@/lib/pdf/imageToJpeg';
import {
  openPdfSource, renderPagesToImages, type OpenPdf, type RenderedPages,
} from '@/lib/pdf/pdfPages';
import { applyAnswerKey } from './answer-key';
import { type AnswerKeyInput } from './answer-key-input';
import { planPageBatches } from './batch-plan';
import { runOcrBatches } from './batch-run';
import { ANSWER_KEY_PAGES_PER_BATCH, answerKeyTurnBudgetMs } from './constants';
import type { MergeResult } from './merge';
import { parseAnswerKeyDraft } from './parse';
import { buildAnswerKeyPrompt, type OcrSourceMeta } from './prompt';
import { ANSWER_KEY_SCHEMA } from './schema';

/**
 * 정답표 읽기 (브라우저 전용).
 *
 * 정답표는 **본문과 따로** 읽는다 — 같은 프롬프트로 읽으면 모델이 문제를 풀어 채우려 든다.
 * 읽을 곳은 두 군데다:
 *  ① 원본 PDF 안에서 '정답표' 로 지정한 쪽
 *  ② 따로 올린 답지 파일 (별지 PDF 하나 또는 사진 여러 장)
 *
 * 둘은 **다른 문서**라 묶음을 섞지 않는다. 섞으면 "보낸 이미지는 N쪽" 안내가 거짓이 되고,
 * 순서가 곧 번호인 정답표에서 순서가 엉킨다.
 *
 * 여기서 실패해도 본문 저장은 막지 않는다 — 정답은 검수에서 손으로 넣을 수 있다.
 */

/** 정답표 이미지를 대는 곳 하나 */
export interface AnswerKeySource {
  /** 별도 답지면 '답지 사진'·'답지 PDF', 원본 안이면 null(쪽 번호를 그대로 쓴다) */
  imageLabel: string | null;
  /** 읽을 쪽 번호(별도 답지는 1..n 의 순번) */
  pages: number[];
  render: (pages: number[]) => Promise<RenderedPages>;
}

/** 정답표 읽기에 필요한 바깥 값들 */
export interface AnswerKeyContext {
  meta: OcrSourceMeta;
  /** 정답을 붙일 대상 — 제자리에서 수정된다 */
  merged: MergeResult;
  maxNumber: number | null;
  port: number;
  pref: { model: string | null; effort: string | null };
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}

/**
 * 원본 PDF 안의 정답표 쪽.
 * @param doc - 이미 열어 둔 원본 문서
 * @param answerPages - 정답표로 지정한 쪽
 * @param signal - 취소 신호
 * @returns 공급원. 지정한 쪽이 없으면 null
 */
export function inDocumentAnswerKey(
  doc: OpenPdf,
  answerPages: number[],
  signal?: AbortSignal,
): AnswerKeySource | null {
  if (answerPages.length === 0) return null;
  return {
    imageLabel: null,
    pages: answerPages,
    render: (pages) => renderPagesToImages(doc, pages, { signal }),
  };
}

/**
 * 따로 올린 답지 파일.
 *
 * PDF 면 문서를 **한 번 더** 연다 — 다 쓰면 반드시 `dispose()` 를 불러야 한다.
 * 사진이면 순번 그대로 JPEG data URL 로 바꾼다(예산을 넘는 장은 건너뛰고 경고가 된다).
 * @param input - 고른 답지
 * @param signal - 취소 신호
 * @returns 공급원과 정리 함수
 * @throws 답지 PDF 를 열지 못했을 때
 */
export async function separateAnswerKey(
  input: AnswerKeyInput,
  signal?: AbortSignal,
): Promise<{ source: AnswerKeySource; dispose: () => void }> {
  if (input.kind === 'pdf') {
    const doc = await openPdfSource({ kind: 'file', file: input.file });
    const pages = Array.from({ length: doc.numPages }, (_, i) => i + 1);
    return {
      source: {
        imageLabel: '답지 PDF',
        pages,
        render: (wanted) => renderPagesToImages(doc, wanted, { signal }),
      },
      dispose: () => doc.pdf.destroy(),
    };
  }

  const files = input.files;
  return {
    source: {
      imageLabel: '답지 사진',
      pages: files.map((_, i) => i + 1),
      render: async (wanted) => {
        const images: string[] = [];
        const rendered: number[] = [];
        const skipped: number[] = [];
        for (const index of wanted) {
          if (signal?.aborted) break;
          const url = await imageFileToJpegDataUrl(files[index - 1]);
          if (!url) { skipped.push(index); continue; }
          images.push(url);
          rendered.push(index);
        }
        return { images, rendered, skipped };
      },
    },
    dispose: () => { /* 사진은 정리할 자원이 없다 */ },
  };
}

/**
 * 공급원들을 차례로 읽어 정답을 붙인다.
 * @param sources - 원본 안 정답표 · 별도 답지
 * @param ctx - 붙일 대상과 실행 환경
 * @returns 보낸 이미지 수와 받은 글자 수
 */
export async function readAnswerKeys(
  sources: AnswerKeySource[],
  ctx: AnswerKeyContext,
): Promise<{ imagesSent: number; rawLength: number }> {
  const plans = sources.map((source) => ({
    source,
    batches: planPageBatches(source.pages, {
      size: ANSWER_KEY_PAGES_PER_BATCH,
      overlap: 0,
    }),
  }));
  // 진행률은 공급원을 합쳐 하나로 센다 — 화면에서 0/2 가 두 번 나오면 멈춘 줄 안다
  const total = plans.reduce((sum, plan) => sum + plan.batches.length, 0);

  let imagesSent = 0;
  let rawLength = 0;
  let done = 0;

  for (const { source, batches } of plans) {
    if (ctx.signal?.aborted) break;
    const offset = done;

    const run = await runOcrBatches({
      batches,
      renderBatch: (pages) => source.render(pages),
      runBatch: async ({ pages, images }) => {
        const raw = await generateDraft({
          port: ctx.port,
          prompt: buildAnswerKeyPrompt({
            source: ctx.meta,
            pages,
            maxNumber: ctx.maxNumber,
            imageLabel: source.imageLabel,
          }),
          outputSchema: ANSWER_KEY_SCHEMA,
          model: ctx.pref.model,
          effort: ctx.pref.effort,
          images,
          signal: ctx.signal,
          timeoutMs: answerKeyTurnBudgetMs(pages.length),
        });
        const draft = parseAnswerKeyDraft(raw, { maxNumber: ctx.maxNumber ?? undefined });
        if (!draft) throw new AiError('invalid_output');
        return { draft, rawLength: raw.length };
      },
      onProgress: (batchDone) => ctx.onProgress?.(offset + batchDone, total),
      signal: ctx.signal,
    });

    ctx.merged.warnings.push(...run.warnings);
    for (const { draft } of run.drafts) {
      // ⚠️ 모델이 정답표를 읽으며 남긴 말도 함께 옮긴다 — 빠뜨리면 "정답표가 흐려서
      //    몇 번을 못 읽었다" 같은 안내가 어디에도 안 나와 정답이 왜 비었는지 알 수 없다
      ctx.merged.warnings.push(...draft.warnings.map((w) => ({ message: w.message })));
      const applied = applyAnswerKey(ctx.merged.problems, draft.answers);
      ctx.merged.warnings.push(...applied.warnings);
    }

    imagesSent += run.imagesSent;
    rawLength += run.rawLength;
    done += batches.length;
  }

  return { imagesSent, rawLength };
}
