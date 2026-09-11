import { AiError, type AiErrorCode } from '@/lib/ai/types';
import { pagesOf, type RenderedImage, type RenderedPages } from '@/lib/pdf/pdfPages';
import type { PageBatch } from './batch-plan';

/**
 * 묶음 **한 번의 시도** — 렌더 → AI 호출 (순수 오케스트레이션).
 *
 * 실행 루프(`batch-run.ts`)에서 떼어 둔 이유: 실패한 묶음을 **쪽을 쪼개 다시 시도**하게
 * 되면서 같은 일을 두 자리에서 하게 됐다. 한 벌로 두어야 재시도와 첫 시도가
 * 조용히 어긋나지 않는다(프롬프트에 실을 쪽 번호를 고르는 규칙이 특히 그렇다).
 */

/** 한 번의 시도 결과 */
export type AttemptResult<TDraft> =
  | { ok: true; draft: TDraft; pages: number[]; imagesSent: number; rawLength: number; skipped: number[] }
  /** 쪽을 이미지로 못 만들었다 — AI 를 부르지도 못했다 */
  | { ok: false; kind: 'render'; message: string; skipped: number[] }
  /** 예산에 못 맞춰 보낼 이미지가 하나도 없다. 다시 시도해도 같은 결과다 */
  | { ok: false; kind: 'empty'; skipped: number[] }
  | { ok: false; kind: 'ai'; code: AiErrorCode; skipped: number[] };

export interface AttemptDeps<TDraft> {
  /**
   * 그 묶음의 쪽을 이미지로. 실패하면 throw 해도 되고 빈 배열을 돌려줘도 된다.
   * `rendered` 는 **실제로 그린 쪽 번호**이고 images 와 순서·길이가 같아야 한다.
   */
  renderBatch: (pages: PageBatch, index: number) => Promise<RenderedPages>;
  /** 취소 신호. **렌더와 호출 사이에서** 본다 — 렌더는 수 초 걸린다 */
  signal?: AbortSignal;
  /** 이미지를 실제로 AI 에 보내 초안 하나를 받는다 */
  runBatch: (args: {
    /** 이 묶음이 실제로 덮는 쪽 (중복 없음) */
    pages: PageBatch;
    /** 이미지 한 장 한 장의 정체 — 프롬프트가 "몇 쪽의 어느 단인지" 를 알려야 한다 */
    rendered: RenderedImage[];
    images: string[];
    index: number;
    total: number;
  }) => Promise<{ draft: TDraft; rawLength: number }>;
}

/**
 * 묶음 하나를 한 번 시도한다.
 * @param pages - 이번에 읽을 쪽
 * @param index - 몇 번째 묶음인가 (0-based, 프롬프트 안내에 쓴다)
 * @param total - 전체 묶음 수
 * @param deps - 렌더·실행 함수
 * @returns 성공한 초안 또는 실패 사유
 */
export async function attemptBatch<TDraft>(
  pages: PageBatch,
  index: number,
  total: number,
  deps: AttemptDeps<TDraft>,
): Promise<AttemptResult<TDraft>> {
  let images: string[] = [];
  // ⚠️ 프롬프트에 실을 것은 요청한 쪽이 아니라 **실제로 그린 이미지**다.
  //    한 쪽이라도 건너뛰면 "이미지 순서 = 이 쪽" 약속이 깨져 내용이 엉뚱한 쪽으로
  //    기록되고, 중복 판정·지문 병합·크롭까지 줄줄이 어긋난다(코덱스 리뷰 6R)
  let rendered: RenderedImage[] = pages.map((page) => ({ page, part: 'full' as const }));
  let skipped: number[] = [];

  try {
    const result = await deps.renderBatch(pages, index);
    images = result.images;
    rendered = result.rendered;
    skipped = result.skipped;
  } catch (e) {
    return {
      ok: false,
      kind: 'render',
      message: e instanceof Error ? e.message : '',
      skipped: [],
    };
  }

  if (images.length === 0) return { ok: false, kind: 'empty', skipped };

  // ⚠️ 렌더는 수 초 걸린다 — 그 사이 취소됐으면 **보내지 않는다**(한도 절약).
  //    이 검사를 호출부에만 두면 재시도 경로가 조용히 빠져나간다
  if (deps.signal?.aborted) return { ok: false, kind: 'ai', code: 'cancelled', skipped };

  try {
    const covered = pagesOf(rendered);
    const { draft, rawLength } = await deps.runBatch({
      pages: covered, rendered, images, index, total,
    });
    return { ok: true, draft, pages: covered, imagesSent: images.length, rawLength, skipped };
  } catch (e) {
    return {
      ok: false,
      kind: 'ai',
      code: e instanceof AiError ? e.code : 'provider_unavailable',
      skipped,
    };
  }
}
