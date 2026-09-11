import { type AiErrorCode } from '@/lib/ai/types';
import { aiErrorMessage } from '@/lib/ai/errors';
import { OCR_MAX_WARNINGS } from './constants';
import type { PageBatch } from './batch-plan';
import { attemptBatch, type AttemptDeps, type AttemptResult } from './batch-attempt';
import {
  capWarnings, listSome, pageTarget, type OcrWarning, type OcrWarningTarget,
} from './warnings';

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
 * ⚠️ 실패한 묶음은 **쪽을 쪼개 한 번 더** 시도한다. 겹침이 1쪽뿐이라 묶음 가운데 쪽은
 *    그 묶음만 보는데, 그 묶음이 죽으면 그 쪽이 통째로 사라진다 — 쪽을 넘어가는 지문의
 *    뒷부분이 없어지던 경로 중 하나가 이것이다. 국어 지문 전사는 출력이 길어
 *    워치독에 걸리기 쉬운데, 쪽을 줄이면 대개 통과한다.
 *
 * 원본: ara-system `app/(admin)/exams/register/lib/examKeyBatch.ts`.
 */

/**
 * 만나면 즉시 멈추는 코드 — 다음 묶음을 보내봐야 같은 이유로 실패하거나(한도·권한),
 * 사람이 이미 그만두라고 한 경우다. 나머지(timeout·invalid_output·provider_unavailable)는
 * 그 묶음만의 문제일 수 있으므로 다시 시도하고, 그래도 안 되면 건너뛰고 계속한다.
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
  | { kind: 'render'; batch: number; message: string; pages: number[]; retried: boolean }
  | { kind: 'ai'; batch: number; code: AiErrorCode; pages: number[]; retried: boolean };

export interface BatchRunResult<TDraft> {
  drafts: { draft: TDraft; pages: number[] }[];
  /** 루프가 만든 경고(건너뛴 쪽·실패한 묶음) — 병합의 leadingWarnings 로 넘긴다 */
  warnings: OcrWarning[];
  /**
   * 실패 내역 — 호출부가 진짜 원인을 고르는 재료.
   * `pages` 는 **끝내 못 읽은 쪽**이다(재시도로 살아난 쪽은 빠져 있다).
   */
  failures: BatchFailure[];
  imagesSent: number;
  rawLength: number;
  /** 쪽을 쪼개 다시 시도한 횟수 — ocr_meta 에 남겨 "왜 오래 걸렸나"를 설명한다 */
  retries: number;
  /** 즉시 중단시킨 코드. 성공 묶음이 하나도 없으면 호출부가 이걸 그대로 던진다 */
  fatal: AiErrorCode | null;
}

export interface BatchRunDeps<TDraft> extends AttemptDeps<TDraft> {
  batches: PageBatch[];
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

/**
 * 실패 내역에서 사람에게 보여 줄 대표 원인 하나를 고른다.
 * @param result - 실행 결과
 * @returns 대표 실패. 실패가 없으면 null
 */
export function representativeFailure<T>(result: BatchRunResult<T>): BatchFailure | null {
  if (result.fatal) {
    const hit = result.failures.find((f) => f.kind === 'ai' && f.code === result.fatal);
    return hit ?? {
      kind: 'ai', batch: 0, code: result.fatal, pages: [], retried: false,
    };
  }
  // AI 실패가 더 구체적이다(렌더 실패는 애초에 보내지도 못한 것)
  return result.failures.find((f) => f.kind === 'ai') ?? result.failures[0] ?? null;
}

/**
 * 다시 시도할 값어치가 있는 실패인가.
 *
 * - `empty` 는 아니다 — 쪽마다 예산을 이미 따로 재서 못 맞춘 것이라 쪼개도 그대로다.
 * - 한 쪽짜리 렌더 실패도 아니다 — 같은 pdf.js 오류가 그대로 난다.
 * - 치명 코드도 아니다(한도·권한·취소).
 */
function worthRetrying<T>(attempt: AttemptResult<T>, pageCount: number): boolean {
  if (attempt.ok) return false;
  if (attempt.kind === 'empty') return false;
  if (attempt.kind === 'render') return pageCount > 1;
  return !FATAL_CODES.has(attempt.code);
}

/**
 * 묶음을 순차 실행한다.
 * @param deps - 묶음 목록과 렌더·실행 함수
 * @returns 성공한 초안들과 실패 내역
 */
export async function runOcrBatches<TDraft>(
  deps: BatchRunDeps<TDraft>,
): Promise<BatchRunResult<TDraft>> {
  const { batches, onProgress, signal } = deps;
  const total = batches.length;

  const drafts: { draft: TDraft; pages: number[] }[] = [];
  const warnings: OcrWarning[] = [];
  const skippedPages: number[] = [];
  const failures: BatchFailure[] = [];
  let imagesSent = 0;
  let rawLength = 0;
  let retries = 0;
  let fatal: AiErrorCode | null = null;

  /** 성공한 시도를 결과에 담는다 */
  const accept = (attempt: Extract<AttemptResult<TDraft>, { ok: true }>) => {
    drafts.push({ draft: attempt.draft, pages: attempt.pages });
    imagesSent += attempt.imagesSent;
    rawLength += attempt.rawLength;
  };

  /** 실패한 시도를 기록한다 — `pages` 는 그 때문에 잃은 쪽이다 */
  const reject = (
    attempt: AttemptResult<TDraft>,
    batch: number,
    pages: number[],
    retried: boolean,
  ) => {
    if (attempt.ok) return;
    failures.push(attempt.kind === 'ai'
      ? { kind: 'ai', batch, code: attempt.code, pages, retried }
      : {
        kind: 'render',
        batch,
        message: attempt.kind === 'render' ? attempt.message : '이 묶음은 보낼 이미지를 만들지 못했어요.',
        pages,
        retried,
      });
  };

  for (let i = 0; i < total; i += 1) {
    if (signal?.aborted) {
      fatal = 'cancelled';
      break;
    }

    const first = await attemptBatch(batches[i], i, total, deps);
    skippedPages.push(...first.skipped);

    if (first.ok) {
      accept(first);
      onProgress?.(i + 1, total);
      continue;
    }

    if (!worthRetrying(first, batches[i].length)) {
      reject(first, i + 1, batches[i], false);
      if (!first.ok && first.kind === 'ai' && FATAL_CODES.has(first.code)) {
        fatal = first.code;
        break;
      }
      onProgress?.(i + 1, total);
      continue;
    }

    // 쪽을 쪼개 다시 — 한 쪽짜리였으면 그대로 한 번 더
    const parts: PageBatch[] = batches[i].length > 1
      ? batches[i].map((page) => [page])
      : [batches[i]];
    const lost: number[] = [];
    // ⚠️ 보고할 원인은 **첫 시도**의 것이다. 재시도는 구조하러 간 것이라 그쪽 오류가
    //    더 흐릴 때가 많다('출력이 길어 시간 초과' → '서비스를 쓸 수 없음').
    //    다만 재시도가 한도·권한 같은 치명 코드를 물어 왔다면 그게 더 할 말이 많다
    let cause: AttemptResult<TDraft> = first;

    for (const [p, part] of parts.entries()) {
      // ⚠️ 치명 코드(한도·권한·취소)를 만나면 **그 자리에서 멈춘다.** 기록만 하고 다음 쪽을
      //    계속 보내면 같은 이유로 실패하면서 한도만 더 태운다. 안 보낸 쪽은 잃은 쪽이다
      if (fatal) {
        lost.push(...parts.slice(p).flat());
        break;
      }
      if (signal?.aborted) {
        lost.push(...parts.slice(p).flat());
        fatal = 'cancelled';
        break;
      }
      retries += 1;
      const again = await attemptBatch(part, i, total, deps);
      skippedPages.push(...again.skipped);
      if (again.ok) {
        accept(again);
        continue;
      }
      lost.push(...part);
      if (again.kind === 'ai' && FATAL_CODES.has(again.code)) {
        fatal = again.code;
        cause = again;
      }
    }

    if (lost.length > 0) reject(cause, i + 1, lost, true);
    onProgress?.(i + 1, total);
    if (fatal) break;
  }

  if (skippedPages.length > 0) {
    warnings.push({
      message: `이미지가 너무 커서 건너뛴 쪽이 있어요: ${listSome(skippedPages)}쪽`,
      targets: skippedPages.map(pageTarget),
    });
  }
  if (failures.length > 0) {
    // 왜 못 읽었는지까지 적는다 — "N묶음 실패"만 남기면 사람이 할 수 있는 일이 없다.
    // **몇 쪽이 비었는지**도 적는다 — '2번째 묶음' 은 선생님이 볼 수 없는 우리 사정이다
    const aiFailure = failures.find((f) => f.kind === 'ai');
    const reason = aiFailure
      ? aiErrorMessage((aiFailure as { code: AiErrorCode }).code)
      : '쪽을 이미지로 만들지 못했어요.';
    const lostPages = failures.flatMap((f) => f.pages);
    const where = lostPages.length > 0
      ? `${listSome(lostPages)}쪽`
      : `${listSome(failures.map((f) => f.batch))}번째 묶음`;
    const targets: OcrWarningTarget[] = [...new Set(lostPages)].map(pageTarget);
    // 다시 시도했는데도 못 읽었다면 그 사실을 밝힌다 — 안 그러면 "한 번 더 해 보라" 고
    // 안내하게 되는데 이미 해 본 것이다
    const again = failures.some((f) => f.retried) ? '쪽을 나눠 다시 시도했지만 ' : '';
    warnings.push({
      message: `${again}${total}묶음 중 ${failures.length}묶음을 읽지 못했어요(${where}). `
        + `그 쪽 내용은 비어 있을 수 있어요 — ${reason}`,
      ...(targets.length > 0 ? { targets } : {}),
    });
  }
  if (fatal === 'cancelled' && drafts.length > 0) {
    warnings.push(`취소하기 전까지 읽은 ${drafts.length}묶음만 담았어요.`);
  }

  return {
    drafts,
    warnings: capWarnings(warnings, OCR_MAX_WARNINGS),
    failures,
    imagesSent,
    rawLength,
    retries,
    fatal,
  };
}
