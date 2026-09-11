'use client';

import { generateDraft } from '@/lib/ai/codex/generateDraft';
import { getCodexModelPref } from '@/lib/ai/localModelPref';
import { getCodexPort } from '@/lib/ai/localPort';
import { AiError } from '@/lib/ai/types';
import { openPdfSource, renderPagesToImages, type OpenPdf } from '@/lib/pdf/pdfPages';
import type { AreaTreeNode } from '@/lib/problem-bank/area-tree';
import { insertPassages, insertProblems, updateSource } from '@/lib/problem-bank/save';
import type { OcrMeta } from '@/types/problem-bank';
import { maxProblemNumber } from './answer-key';
import { answerKeyImageCount, type AnswerKeyInput } from './answer-key-input';
import { planPageBatches } from './batch-plan';
import { representativeFailure, runOcrBatches } from './batch-run';
import { OCR_SPLIT_COLUMNS, ocrTurnBudgetMs } from './constants';
import { mergeOcrDrafts } from './merge';
import type { MergeResult } from './merge';
import { OCR_MAX_MERGED_WARNINGS } from './constants';
import { capWarnings, dedupeWarnings, itemTargetLabel } from './warnings';
import { parseOcrDraft } from './parse';
import { buildProblemOcrPrompt, type OcrSourceMeta } from './prompt';
import {
  inDocumentAnswerKey, readAnswerKeys, separateAnswerKey, type AnswerKeySource,
} from './run-answer-key';
import { cropRegions, uploadPageImages } from './run-images';
import { PROBLEM_OCR_SCHEMA } from './schema';

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
  /** 정답표가 있는 쪽 (원본 PDF 안) */
  answerPages: number[];
  /** 따로 올린 답지 파일 (없으면 null) */
  answerKey?: AnswerKeyInput | null;
  areaTree: AreaTreeNode[];
  /** 교과서 단원 트리 (대단원 › 소단원). 교과서를 안 골랐으면 빈 배열 */
  unitTree: AreaTreeNode[];
  /** 관리자시스템 내신 관리에 체크된 단원 키 — 모델에게 어디부터 볼지 알려 준다 */
  scopeUnits: string[];
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
      // 2단 쪽은 단별로 갈라 보낸다 — 읽을 순서가 하나뿐이라 두 단이 뒤섞이지 않고,
      // 같은 바이트가 절반의 넓이에 쓰여 글자가 커진다(columnDetect.ts)
      renderBatch: (pages) => renderPagesToImages(doc, pages, {
        signal, splitColumns: OCR_SPLIT_COLUMNS,
      }),
      runBatch: async ({ pages, rendered, images, index, total }) => {
        const raw = await generateDraft({
          port,
          prompt: buildProblemOcrPrompt({
            source: input.meta,
            pages,
            rendered,
            batch: { index, total },
            areaTree: input.areaTree,
            unitTree: input.unitTree,
            scopeUnits: input.scopeUnits,
          }),
          outputSchema: PROBLEM_OCR_SCHEMA,
          model: pref.model,
          effort: pref.effort,
          images,
          signal,
          timeoutMs: ocrTurnBudgetMs(pages.length),
        });
        const draft = parseOcrDraft(raw, {
          pages, areaTree: input.areaTree, unitTree: input.unitTree,
        });
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

    // 정답표는 따로 읽는다 — 본문과 같은 프롬프트로 읽으면 모델이 문제를 풀려 든다.
    // 원본 안의 정답표 쪽과 따로 올린 답지를 한 번에 훑는다.
    const answerRun = await readAllAnswerKeys(input, doc, merged, {
      port, pref, signal, onProgress,
    });

    onProgress?.({ phase: 'crop', done: 0, total: merged.passages.length + merged.problems.length });
    const cropped = await cropRegions(doc, merged, signal, onProgress);
    merged.warnings.push(...cropped.warnings);

    // ⚠️ 여러 쪽에 걸친 그림 지문은 **어느 쪽으로도 온전하지 않다** —
    //    글만 쓰면 그림이 빠지고, 이미지로 쓰면 잘라 둔 시작 쪽만 나가 뒷부분이 사라진다.
    //    자동으로 고를 수 없으니 검수에서 사람이 보게 드러낸다(코덱스 리뷰 20R).
    const splitFigures = merged.passages.filter((p) => p.has_figure && p.pageSpan > 1);
    if (splitFigures.length > 0) {
      merged.warnings.push({
        message: `그림·표가 있으면서 여러 쪽에 걸친 지문이 ${splitFigures.length}개 있어요`
          + `(${splitFigures.map((p) => `${p.page_no}쪽`).slice(0, 5).join(', ')}). `
          + '글만으로는 그림이 빠지고 이미지로 두면 뒷부분이 빠지니, 검수에서 직접 확인해 주세요.',
        targets: splitFigures.map((p) => ({
          kind: 'passage' as const,
          id: p.id,
          page: p.page_no,
          label: itemTargetLabel({ kind: 'passage', page: p.page_no }),
        })),
      });
    }

    onProgress?.({ phase: 'save', done: 0, total: 1 });
    // 묶음 하나라도 들어가면 곧바로 표시한다 — 중간에 실패해도 앞 묶음은 남아 있어서,
    // "하나도 안 들어갔다" 고 안내하면 거짓말이 된다(트랜잭션이 아니다)
    const markSaved = () => { savedAnything = true; };
    await insertPassages(input.sourceId, merged.passages, cropped.passageImages, markSaved);
    await insertProblems(input.sourceId, merged.problems, cropped.problemImages, markSaved);

    // ⚠️ 병합 뒤에 붙은 경고들(정답표·크롭·그림 지문)은 각자 상한을 안 거쳤다 —
    //    저장 직전에 한 번 정리한다. 안 그러면 ocr_meta 가 끝없이 커진다
    merged.warnings = capWarnings(dedupeWarnings(merged.warnings), OCR_MAX_MERGED_WARNINGS);

    const meta: OcrMeta = {
      model: pref.model,
      effort: pref.effort,
      pages: [...input.problemPages, ...input.answerPages].sort((a, b) => a - b),
      batches: batches.length,
      retries: ocrRun.retries + answerRun.retries,
      durationMs: Date.now() - startedAt,
      imagesSent: ocrRun.imagesSent + answerRun.imagesSent,
      warnings: merged.warnings,
      answerKeyFiles: answerKeyImageCount(input.answerKey ?? null),
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
        // ⚠️ ocr_meta 는 통째로 덮어쓴다 — 실패 경로에서도 답지 수를 빠뜨리면
        //    검수 화면이 "답지를 안 올렸다"고 거짓말을 한다
        answerKeyFiles: answerKeyImageCount(input.answerKey ?? null),
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

/** 원본 안 정답표 쪽과 별도 답지를 모두 읽는다. 실패해도 본문 저장을 막지 않는다 */
async function readAllAnswerKeys(
  input: OcrRunInput,
  doc: OpenPdf,
  merged: MergeResult,
  env: {
    port: number;
    pref: { model: string | null; effort: string | null };
    signal?: AbortSignal;
    onProgress?: (p: OcrRunProgress) => void;
  },
): Promise<{ imagesSent: number; rawLength: number; retries: number }> {
  const empty = { imagesSent: 0, rawLength: 0, retries: 0 };
  if (env.signal?.aborted) return empty;

  const sources: AnswerKeySource[] = [];
  const inDoc = inDocumentAnswerKey(doc, input.answerPages, env.signal);
  if (inDoc) sources.push(inDoc);

  let disposeSeparate: (() => void) | null = null;
  if (input.answerKey) {
    try {
      const separate = await separateAnswerKey(input.answerKey, env.signal);
      disposeSeparate = separate.dispose;
      sources.push(separate.source);
    } catch {
      // 답지를 못 열어도 본문은 이미 다 읽었다 — 경고만 남기고 계속한다
      merged.warnings.push(
        '따로 올린 답지를 열지 못했어요. 정답은 검수 화면에서 직접 넣어 주세요.',
      );
    }
  }

  // ⚠️ 여기부터는 반드시 finally 안이다 — 답지 PDF 를 열어 둔 채 빠져나가면
  //    그 문서가 영영 안 닫힌다(읽을 것이 없어 곧바로 돌아가는 길 포함)
  try {
    if (sources.length === 0) return empty;
    return await readAnswerKeys(sources, {
      meta: input.meta,
      merged,
      // 읽어 낸 마지막 번호를 알려 주면 모델이 만든 헛번호를 파서가 걸러낸다
      maxNumber: input.maxNumber ?? maxProblemNumber(merged.problems),
      port: env.port,
      pref: env.pref,
      signal: env.signal,
      onProgress: (done, total) => env.onProgress?.({ phase: 'answer-key', done, total }),
    });
  } finally {
    // 답지 PDF 를 두 번째로 열었으면 반드시 닫는다
    disposeSeparate?.();
  }
}
