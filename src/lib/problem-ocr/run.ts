'use client';

import { generateDraft } from '@/lib/ai/codex/generateDraft';
import { getCodexModelPref } from '@/lib/ai/localModelPref';
import { getCodexPort } from '@/lib/ai/localPort';
import { AiError } from '@/lib/ai/types';
import { openPdfSource, renderPagesToImages, type OpenPdf } from '@/lib/pdf/pdfPages';
import type { AreaTreeNode } from '@/lib/problem-bank/area-tree';
import { insertPassages, insertProblems, updateSource } from '@/lib/problem-bank/save';
import { uploadProblemFile } from '@/lib/problem-bank/storage';
import { passageRegionPath, problemRegionPath } from '@/lib/problem-bank/storage-paths';
import type { OcrMeta } from '@/types/problem-bank';
import { applyAnswerKey } from './answer-key';
import { planPageBatches } from './batch-plan';
import { representativeFailure, runOcrBatches } from './batch-run';
import { ANSWER_KEY_PAGES_PER_BATCH, answerKeyTurnBudgetMs, ocrTurnBudgetMs } from './constants';
import { boxToBbox } from './crop';
import { PageCropper } from './crop-dom';
import { mergeOcrDrafts, type MergeResult } from './merge';
import { parseAnswerKeyDraft, parseOcrDraft } from './parse';
import { buildAnswerKeyPrompt, buildProblemOcrPrompt, type OcrSourceMeta } from './prompt';
import { ANSWER_KEY_SCHEMA, PROBLEM_OCR_SCHEMA } from './schema';

/**
 * 기출 PDF 한 건을 읽어 아카이브에 넣는 전체 흐름 (브라우저 전용).
 *
 * 단계마다 실패를 다르게 다룬다:
 *  - 묶음 실패는 건너뛰고 계속한다(이미 태운 ChatGPT 사용량을 버리지 않는다).
 *  - 크롭·이미지 업로드 실패는 **저장을 막지 않는다**(본문은 멀쩡하다).
 *  - 저장 실패만 통째로 던진다.
 */

export interface OcrRunInput {
  sourceId: string;
  file: File;
  meta: OcrSourceMeta;
  /** 문항·지문이 있는 쪽 */
  problemPages: number[];
  /** 정답표가 있는 쪽 */
  answerPages: number[];
  areaTree: AreaTreeNode[];
  /** 원본 시험지의 마지막 문항 번호(알 때) */
  maxNumber?: number | null;
}

export interface OcrRunProgress {
  phase: 'ocr' | 'answer-key' | 'crop' | 'save';
  done: number;
  total: number;
}

export interface OcrRunResult {
  merged: MergeResult;
  meta: OcrMeta;
}

/** 진행률과 취소를 받아 OCR 을 끝까지 돌린다 */
export async function runProblemOcr(
  input: OcrRunInput,
  opts: { signal?: AbortSignal; onProgress?: (p: OcrRunProgress) => void } = {},
): Promise<OcrRunResult> {
  const { signal, onProgress } = opts;
  const startedAt = Date.now();
  const port = getCodexPort();
  const pref = getCodexModelPref();

  // 문서는 **한 번만** 연다 — 묶음마다 열면 파일 전체를 매번 복사한다
  const doc: OpenPdf = await openPdfSource({ kind: 'file', file: input.file });

  try {
    const batches = planPageBatches(input.problemPages);

    const ocrRun = await runOcrBatches({
      batches,
      renderBatch: (pages) => renderPagesToImages(doc, pages, { signal }),
      runBatch: async ({ pages, images, index, total }) => {
        const raw = await generateDraft({
          port,
          prompt: buildProblemOcrPrompt({
            source: input.meta, pages, batch: { index, total }, areaTree: input.areaTree,
          }),
          outputSchema: PROBLEM_OCR_SCHEMA,
          model: pref.model,
          effort: pref.effort,
          images,
          signal,
          timeoutMs: ocrTurnBudgetMs(pages.length),
        });
        const draft = parseOcrDraft(raw, { pages, areaTree: input.areaTree });
        if (!draft) throw new AiError('invalid_output');
        return { draft, rawLength: raw.length };
      },
      onProgress: (done, total) => onProgress?.({ phase: 'ocr', done, total }),
      signal,
    });

    // 한 묶음도 못 읽었으면 원인을 그대로 올린다 — "0건 저장"으로 끝내면 왜인지 모른다
    if (ocrRun.drafts.length === 0) {
      const failure = representativeFailure(ocrRun);
      throw failure?.kind === 'ai'
        ? new AiError(failure.code)
        : new AiError('provider_unavailable');
    }

    const merged = mergeOcrDrafts(ocrRun.drafts, { leadingWarnings: ocrRun.warnings });

    // 정답표는 따로 읽는다 — 본문과 같은 프롬프트로 읽으면 모델이 문제를 풀려 든다
    let answerRun = { imagesSent: 0, rawLength: 0 };
    if (input.answerPages.length > 0 && !signal?.aborted) {
      answerRun = await readAnswerKey(input, doc, merged, port, pref, signal, onProgress);
    }

    onProgress?.({ phase: 'crop', done: 0, total: merged.passages.length + merged.problems.length });
    const cropped = await cropRegions(doc, merged, signal, onProgress);

    onProgress?.({ phase: 'save', done: 0, total: 1 });
    await insertPassages(input.sourceId, merged.passages, cropped.passageImages);
    await insertProblems(input.sourceId, merged.problems, cropped.problemImages);

    const meta: OcrMeta = {
      model: pref.model,
      effort: pref.effort,
      pages: [...input.problemPages, ...input.answerPages].sort((a, b) => a - b),
      batches: batches.length,
      durationMs: Date.now() - startedAt,
      imagesSent: ocrRun.imagesSent + answerRun.imagesSent,
      warnings: merged.warnings,
      ranAt: new Date().toISOString(),
    };
    await updateSource(input.sourceId, { status: '검수중', ocr_meta: meta });

    onProgress?.({ phase: 'save', done: 1, total: 1 });
    return { merged, meta };
  } finally {
    doc.pdf.destroy();
  }
}

/** 정답표 쪽을 읽어 문항에 붙인다. 실패해도 본문 저장을 막지 않는다 */
async function readAnswerKey(
  input: OcrRunInput,
  doc: OpenPdf,
  merged: MergeResult,
  port: number,
  pref: { model: string | null; effort: string | null },
  signal: AbortSignal | undefined,
  onProgress?: (p: OcrRunProgress) => void,
): Promise<{ imagesSent: number; rawLength: number }> {
  const batches = planPageBatches(input.answerPages, {
    size: ANSWER_KEY_PAGES_PER_BATCH,
    overlap: 0,
  });

  const run = await runOcrBatches({
    batches,
    renderBatch: (pages) => renderPagesToImages(doc, pages, { signal }),
    runBatch: async ({ pages, images }) => {
      const raw = await generateDraft({
        port,
        prompt: buildAnswerKeyPrompt({
          source: input.meta, pages, maxNumber: input.maxNumber ?? null,
        }),
        outputSchema: ANSWER_KEY_SCHEMA,
        model: pref.model,
        effort: pref.effort,
        images,
        signal,
        timeoutMs: answerKeyTurnBudgetMs(pages.length),
      });
      const draft = parseAnswerKeyDraft(raw, { maxNumber: input.maxNumber ?? undefined });
      if (!draft) throw new AiError('invalid_output');
      return { draft, rawLength: raw.length };
    },
    onProgress: (done, total) => onProgress?.({ phase: 'answer-key', done, total }),
    signal,
  });

  merged.warnings.push(...run.warnings);
  for (const { draft } of run.drafts) {
    const applied = applyAnswerKey(merged.problems, draft.answers);
    merged.warnings.push(...applied.warnings);
  }
  return { imagesSent: run.imagesSent, rawLength: run.rawLength };
}

/** 문항·지문 영역을 잘라 올린다. 실패한 것은 경로 없이 두고 넘어간다 */
async function cropRegions(
  doc: OpenPdf,
  merged: MergeResult,
  signal: AbortSignal | undefined,
  onProgress?: (p: OcrRunProgress) => void,
): Promise<{ passageImages: Map<string, string>; problemImages: Map<string, string> }> {
  const cropper = new PageCropper(doc);
  const passageImages = new Map<string, string>();
  const problemImages = new Map<string, string>();

  const targets: { id: string; page: number; box: NonNullable<PassageBox>; kind: 'passage' | 'problem' }[] = [
    ...merged.passages.filter((p) => p.box).map((p) => ({
      id: p.id, page: p.page_no, box: p.box!, kind: 'passage' as const,
    })),
    ...merged.problems.filter((p) => p.box).map((p) => ({
      id: p.id, page: p.page_no, box: p.box!, kind: 'problem' as const,
    })),
  ];

  try {
    let done = 0;
    for (const target of targets) {
      if (signal?.aborted) break;
      const blob = await cropper.crop(target.page, boxToBbox(target.box));
      if (blob) {
        const path = target.kind === 'passage'
          ? passageRegionPath(target.id)
          : problemRegionPath(target.id);
        try {
          await uploadProblemFile(path, blob, 'image/jpeg');
          (target.kind === 'passage' ? passageImages : problemImages).set(target.id, path);
        } catch {
          // 이미지가 없어도 본문은 멀쩡하다 — 저장을 막지 않는다
        }
      }
      done += 1;
      onProgress?.({ phase: 'crop', done, total: targets.length });
    }
  } finally {
    cropper.dispose();
  }

  return { passageImages, problemImages };
}

type PassageBox = MergeResult['passages'][number]['box'];
