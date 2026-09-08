'use client';

import { generateDraft } from '@/lib/ai/codex/generateDraft';
import { getCodexModelPref } from '@/lib/ai/localModelPref';
import { getCodexPort } from '@/lib/ai/localPort';
import { AiError } from '@/lib/ai/types';
import { openPdfSource, renderPagesToImages, type OpenPdf } from '@/lib/pdf/pdfPages';
import type { AreaTreeNode } from '@/lib/problem-bank/area-tree';
import { insertPassages, insertProblems, updateSource } from '@/lib/problem-bank/save';
import { uploadProblemFile } from '@/lib/problem-bank/storage';
import {
  passageRegionPath, problemRegionPath, sourcePagePath,
} from '@/lib/problem-bank/storage-paths';
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
  phase: 'page' | 'ocr' | 'answer-key' | 'crop' | 'save';
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

  // 실패·취소했을 때 출처를 어떤 상태로 남길지 판단하는 데 쓴다
  let savedAnything = false;

  try {
    // 검수 화면이 원본과 대조할 페이지 이미지를 먼저 올린다.
    // ⚠️ 이걸 빼면 검수 화면의 왼쪽(원본) 칸이 **늘 비어 있고**, 선생님이 잘못 읽은
    //    글자를 알아챌 방법이 사라진다(코덱스 리뷰가 잡은 결함).
    await uploadPageImages(input, doc, signal, onProgress);

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
    merged.warnings.push(...cropped.warnings);

    // ⚠️ 여러 쪽에 걸친 그림 지문은 **어느 쪽으로도 온전하지 않다** —
    //    글만 쓰면 그림이 빠지고, 이미지로 쓰면 잘라 둔 시작 쪽만 나가 뒷부분이 사라진다.
    //    자동으로 고를 수 없으니 검수에서 사람이 보게 드러낸다(코덱스 리뷰 20R).
    const splitFigures = merged.passages.filter((p) => p.has_figure && p.pageSpan > 1);
    if (splitFigures.length > 0) {
      merged.warnings.push(
        `그림·표가 있으면서 여러 쪽에 걸친 지문이 ${splitFigures.length}개 있어요`
        + `(${splitFigures.map((p) => `${p.page_no}쪽`).slice(0, 5).join(', ')}). `
        + '글만으로는 그림이 빠지고 이미지로 두면 뒷부분이 빠지니, 검수에서 직접 확인해 주세요.',
      );
    }

    onProgress?.({ phase: 'save', done: 0, total: 1 });
    // 묶음 하나라도 들어가면 곧바로 표시한다 — 중간에 실패해도 앞 묶음은 남아 있어서,
    // "하나도 안 들어갔다" 고 안내하면 거짓말이 된다(트랜잭션이 아니다)
    const markSaved = () => { savedAnything = true; };
    await insertPassages(input.sourceId, merged.passages, cropped.passageImages, markSaved);
    await insertProblems(input.sourceId, merged.problems, cropped.problemImages, markSaved);

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
  } catch (e) {
    // ⚠️ '추출중' 인 채로 두면 안 된다. 업로드가 그 상태로 만들어 두고 성공 경로만
    //    상태를 바꾸므로, 실패·취소한 작업이 **영영 돌고 있는 것처럼** 보인다
    //    (코덱스 리뷰 12R). 저장된 게 있으면 검수중, 없으면 업로드로 되돌린다.
    await updateSource(input.sourceId, {
      status: savedAnything ? '검수중' : '업로드',
      ocr_meta: {
        pages: [...input.problemPages, ...input.answerPages].sort((a, b) => a - b),
        durationMs: Date.now() - startedAt,
        ranAt: new Date().toISOString(),
        warnings: [
          e instanceof Error && e.message ? `읽기가 끝나지 못했어요: ${e.message}` : '읽기가 끝나지 못했어요.',
          savedAnything
            ? '읽은 부분만 담겼어요. 검수에서 확인하고, 필요하면 다시 업로드해 주세요.'
            : '담긴 문항이 없어요. 업로드 화면에서 다시 시도해 주세요.',
        ],
      },
    }).catch(() => {
      // 상태 정리까지 실패하면 어쩔 수 없다 — 원래 오류를 가리지 않는다
    });
    throw e;
  } finally {
    doc.pdf.destroy();
  }
}

/**
 * 검수용 페이지 이미지를 Storage 에 올린다.
 *
 * 정답표 쪽까지 함께 올린다 — 정답이 이상할 때 어디서 읽었는지 봐야 한다.
 * 한 장이 실패해도 다음 장을 계속 올린다(원본 대조가 부분적으로라도 되는 편이 낫다).
 */
async function uploadPageImages(
  input: OcrRunInput,
  doc: OpenPdf,
  signal: AbortSignal | undefined,
  onProgress?: (p: OcrRunProgress) => void,
): Promise<void> {
  const pages = [...new Set([...input.problemPages, ...input.answerPages])]
    .filter((n) => Number.isInteger(n) && n >= 1)
    .sort((a, b) => a - b);
  if (pages.length === 0) return;

  // 캔버스 캐시를 쓰는 도구를 재사용한다. data URL → fetch → Blob 수법은
  // CSP connect-src 가 `data:` 를 막아 **전부 실패**한다(코덱스 리뷰 2R)
  const cropper = new PageCropper(doc);
  let done = 0;
  try {
    for (const page of pages) {
      if (signal?.aborted) return;
      const blob = await cropper.pageBlob(page);
      if (blob) {
        try {
          await uploadProblemFile(sourcePagePath(input.sourceId, page), blob, 'image/jpeg');
        } catch {
          // 원본 이미지가 없어도 문항은 읽힌다 — 여기서 멈추지 않는다
        }
      }
      done += 1;
      onProgress?.({ phase: 'page', done, total: pages.length });
    }
  } finally {
    cropper.dispose();
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
): Promise<{
  passageImages: Map<string, string>;
  problemImages: Map<string, string>;
  warnings: string[];
}> {
  const cropper = new PageCropper(doc);
  const passageImages = new Map<string, string>();
  const problemImages = new Map<string, string>();
  const warnings: string[] = [];

  interface CropTarget {
    id: string;
    page: number;
    box: NonNullable<PassageBox>;
    kind: 'passage' | 'problem';
    /** 그림·표가 있어 **글만으로는 온전하지 않은** 항목 — 실패를 조용히 넘기면 안 된다 */
    needsImage: boolean;
    label: string;
  }

  const targets: CropTarget[] = [
    ...merged.passages.filter((p) => p.box).map((p) => ({
      id: p.id, page: p.page_no, box: p.box!, kind: 'passage' as const,
      needsImage: p.has_figure, label: `${p.page_no}쪽 지문`,
    })),
    ...merged.problems.filter((p) => p.box).map((p) => ({
      id: p.id, page: p.page_no, box: p.box!, kind: 'problem' as const,
      needsImage: p.has_figure,
      label: p.number !== null ? `${p.number}번` : `${p.page_no}쪽 문항`,
    })),
  ];

  // 그림이 있다고 표시됐는데 좌표가 없으면 애초에 자를 수가 없다 — 그것도 알린다
  const noBox = [
    ...merged.passages.filter((p) => p.has_figure && !p.box).map((p) => `${p.page_no}쪽 지문`),
    ...merged.problems.filter((p) => p.has_figure && !p.box)
      .map((p) => (p.number !== null ? `${p.number}번` : `${p.page_no}쪽 문항`)),
  ];
  const failed: string[] = [...noBox];

  try {
    let done = 0;
    for (let i = 0; i < targets.length; i += 1) {
      const target = targets[i];
      if (signal?.aborted) {
        // ⚠️ 취소로 멈춰도 **남은 그림 항목은 경고에 넣는다.** 호출부는 여기까지 읽은
        //    결과를 그대로 저장하는데, 이미지 없이 저장된 그림 문항은 글만으로는
        //    내용이 빠진 상태다 — 조용히 아카이브에 들어가면 안 된다(코덱스 리뷰 19R)
        failed.push(...targets.slice(i).filter((t) => t.needsImage).map((t) => t.label));
        break;
      }
      const blob = await cropper.crop(target.page, boxToBbox(target.box));
      let ok = false;
      if (blob) {
        const path = target.kind === 'passage'
          ? passageRegionPath(target.id)
          : problemRegionPath(target.id);
        try {
          await uploadProblemFile(path, blob, 'image/jpeg');
          (target.kind === 'passage' ? passageImages : problemImages).set(target.id, path);
          ok = true;
        } catch {
          // 이미지가 없어도 본문은 멀쩡하다 — 저장을 막지 않는다
        }
      }
      // ⚠️ 그림이 있는 항목은 다르다. 프롬프트가 "옮길 수 있는 글자만 적으라" 고 시켰으므로
      //    글만으로는 온전하지 않다. 이미지를 못 만들었으면 **반드시 알린다**(코덱스 리뷰 17R)
      if (!ok && target.needsImage) failed.push(target.label);
      done += 1;
      onProgress?.({ phase: 'crop', done, total: targets.length });
    }
  } finally {
    cropper.dispose();
  }

  if (failed.length > 0) {
    warnings.push(
      `그림·표가 있는 항목의 이미지를 만들지 못했어요(${failed.slice(0, 8).join(', ')}`
      + `${failed.length > 8 ? ` 외 ${failed.length - 8}개` : ''}). `
      + '글만으로는 내용이 빠질 수 있으니 검수에서 확인해 주세요.',
    );
  }

  return { passageImages, problemImages, warnings };
}

type PassageBox = MergeResult['passages'][number]['box'];
