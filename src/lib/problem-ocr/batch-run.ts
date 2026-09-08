import { AiError, type AiErrorCode } from '@/lib/ai/types';
import { aiErrorMessage } from '@/lib/ai/errors';
import { OCR_MAX_WARNINGS } from './constants';
import type { PageBatch } from './batch-plan';

/**
 * 묶음을 **순차로** 실행한다.
 *
 * 병렬로 돌리지 않는 이유: 선생님 PC 의 codex 한 대가 처리한다. 동시에 밀어넣으면
 * 한도만 빨리 태우면서 서로 느려진다.
 *
 * 부분 실패를 허용한다 — 6묶음 중 하나가 죽었다고 나머지 5묶음을 버리면 이미 태운
 * ChatGPT 사용량이 통째로 낭비된다. 대신 **실패를 경고로 반드시 드러낸다**:
 * 일부만 읽고 전체를 읽은 척하지 않는다.
 *
 * 원본: ara-system `app/(admin)/exams/register/lib/examKeyBatch.ts`.
 */

/**
 * 만나면 즉시 멈추는 코드 — 다음 묶음을 보내봐야 같은 이유로 실패하거나(한도·권한),
 * 사람이 이미 그만두라고 한 경우다. 나머지(timeout·invalid_output·provider_unavailable)는
 * 그 묶음만의 문제일 수 있으므로 건너뛰고 계속한다.
 */
const FATAL_CODES = new Set<AiErrorCode>([
  'cancelled', 'feature_disabled', 'usage_limit_exceeded',
  'unauthorized', 'not_connected', 'login_expired',
  'access_denied', 'sensitive_input_rejected',
]);

/**
 * 묶음이 왜 실패했는가. **뭉뚱그리면 안 된다** — 렌더 실패(PDF·브라우저 문제)와
 * AI 실패(한도·시간초과·형식)는 사람이 할 일이 완전히 다르다.
 */
export type BatchFailure =
  | { kind: 'render'; batch: number; message: string }
  | { kind: 'ai'; batch: number; code: AiErrorCode };

export interface BatchRunResult<TDraft> {
  drafts: { draft: TDraft; pages: number[] }[];
  /** 루프가 만든 경고(건너뛴 쪽·실패한 묶음) — 병합의 leadingWarnings 로 넘긴다 */
  warnings: string[];
  /** 묶음별 실패 내역 — 하나도 성공 못 했을 때 호출부가 진짜 원인을 고르는 재료 */
  failures: BatchFailure[];
  imagesSent: number;
  rawLength: number;
  /** 즉시 중단시킨 코드. 성공 묶음이 하나도 없으면 호출부가 이걸 그대로 던진다 */
  fatal: AiErrorCode | null;
}

export interface BatchRunDeps<TDraft> {
  batches: PageBatch[];
  /** 그 묶음의 쪽을 이미지로. 실패하면 throw 해도 되고 빈 배열을 돌려줘도 된다 */
  renderBatch: (pages: PageBatch, index: number) => Promise<{ images: string[]; skipped: number[] }>;
  /** 이미지를 실제로 AI 에 보내 초안 하나를 받는다 */
  runBatch: (args: {
    pages: PageBatch;
    images: string[];
    index: number;
    total: number;
  }) => Promise<{ draft: TDraft; rawLength: number }>;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

/** 번호를 몇 개만 보여 준다 */
function listSome(numbers: number[], limit = 8): string {
  const uniq = [...new Set(numbers)].sort((a, b) => a - b);
  const head = uniq.slice(0, limit).join(', ');
  return uniq.length > limit ? `${head} 외 ${uniq.length - limit}개` : head;
}

/**
 * 실패 내역에서 사람에게 보여 줄 대표 원인 하나를 고른다.
 * @param result - 실행 결과
 * @returns 대표 실패. 실패가 없으면 null
 */
export function representativeFailure<T>(result: BatchRunResult<T>): BatchFailure | null {
  if (result.fatal) {
    const hit = result.failures.find((f) => f.kind === 'ai' && f.code === result.fatal);
    return hit ?? { kind: 'ai', batch: 0, code: result.fatal };
  }
  // AI 실패가 더 구체적이다(렌더 실패는 애초에 보내지도 못한 것)
  return result.failures.find((f) => f.kind === 'ai') ?? result.failures[0] ?? null;
}

/**
 * 묶음을 순차 실행한다.
 * @param deps - 묶음 목록과 렌더·실행 함수
 * @returns 성공한 초안들과 실패 내역
 */
export async function runOcrBatches<TDraft>(
  deps: BatchRunDeps<TDraft>,
): Promise<BatchRunResult<TDraft>> {
  const { batches, renderBatch, runBatch, onProgress, signal } = deps;
  const total = batches.length;

  const drafts: { draft: TDraft; pages: number[] }[] = [];
  const warnings: string[] = [];
  const skippedPages: number[] = [];
  const failures: BatchFailure[] = [];
  let imagesSent = 0;
  let rawLength = 0;
  let fatal: AiErrorCode | null = null;

  for (let i = 0; i < total; i += 1) {
    if (signal?.aborted) {
      fatal = 'cancelled';
      break;
    }

    let images: string[] = [];
    try {
      const rendered = await renderBatch(batches[i], i);
      images = rendered.images;
      skippedPages.push(...rendered.skipped);
    } catch (e) {
      failures.push({
        kind: 'render',
        batch: i + 1,
        message: e instanceof Error ? e.message : '',
      });
      onProgress?.(i + 1, total);
      continue;
    }

    // 렌더는 수 초 걸린다 — 그 사이 취소됐으면 보내지 않는다(한도 절약)
    if (signal?.aborted) {
      fatal = 'cancelled';
      break;
    }
    if (images.length === 0) {
      failures.push({
        kind: 'render',
        batch: i + 1,
        message: '이 묶음은 보낼 이미지를 만들지 못했어요.',
      });
      onProgress?.(i + 1, total);
      continue;
    }

    try {
      const { draft, rawLength: len } = await runBatch({
        pages: batches[i], images, index: i, total,
      });
      drafts.push({ draft, pages: batches[i] });
      imagesSent += images.length;
      rawLength += len;
    } catch (e) {
      const code = e instanceof AiError ? e.code : 'provider_unavailable';
      failures.push({ kind: 'ai', batch: i + 1, code });
      if (FATAL_CODES.has(code)) {
        fatal = code;
        break;
      }
    }
    onProgress?.(i + 1, total);
  }

  if (skippedPages.length > 0) {
    warnings.push(`이미지가 너무 커서 건너뛴 쪽이 있어요: ${listSome(skippedPages)}쪽`);
  }
  if (failures.length > 0) {
    // 왜 못 읽었는지까지 적는다 — "N묶음 실패"만 남기면 사람이 할 수 있는 일이 없다
    const aiFailure = failures.find((f) => f.kind === 'ai');
    const reason = aiFailure
      ? aiErrorMessage((aiFailure as { code: AiErrorCode }).code)
      : '쪽을 이미지로 만들지 못했어요.';
    warnings.push(
      `${total}묶음 중 ${failures.length}묶음을 읽지 못했어요(${listSome(failures.map((f) => f.batch))}번째). `
      + `그 쪽 내용은 비어 있을 수 있어요 — ${reason}`,
    );
  }
  if (fatal === 'cancelled' && drafts.length > 0) {
    warnings.push(`취소하기 전까지 읽은 ${drafts.length}묶음만 담았어요.`);
  }

  return {
    drafts,
    warnings: warnings.slice(0, OCR_MAX_WARNINGS),
    failures,
    imagesSent,
    rawLength,
    fatal,
  };
}
