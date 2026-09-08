import { OCR_BATCH_OVERLAP, OCR_PAGES_PER_BATCH } from './constants';

/**
 * 읽을 쪽을 묶음으로 나눈다 (순수 함수).
 *
 * 묶음 수를 **렌더하기 전에** 알 수 있어야 한다 —
 * 진행률 표시와 "ChatGPT 를 N번 씁니다" 사전 안내가 여기에 달려 있다.
 */

/** 한 묶음이 읽을 쪽 번호들 (1-based, 오름차순) */
export type PageBatch = number[];

export interface PlanOptions {
  /** 한 묶음의 쪽 수 */
  size?: number;
  /** 앞 묶음과 겹칠 쪽 수 */
  overlap?: number;
}

/**
 * 쪽 목록을 겹침 있는 묶음으로 나눈다.
 *
 * 겹치는 이유: 지문이 쪽 경계를 넘으면 어느 묶음도 그 지문을 통째로 못 봐서
 * **반씩 잘린 지문 두 개**가 생긴다. 한 쪽만 겹쳐도 경계를 넘는 지문은
 * 최소 한 묶음 안에 온전히 들어온다(뒤처리는 merge.ts 가 한다).
 *
 * @param pages - 읽을 쪽 번호(중복·순서 무관)
 * @param opts - 묶음 크기와 겹침
 * @returns 묶음 목록. 쪽이 없으면 빈 배열
 */
export function planPageBatches(pages: number[], opts: PlanOptions = {}): PageBatch[] {
  const size = Math.max(1, Math.floor(opts.size ?? OCR_PAGES_PER_BATCH));
  // 겹침이 묶음 크기 이상이면 진행이 안 된다(무한 루프) — 반드시 size 미만으로 가둔다
  const overlap = Math.min(Math.max(0, Math.floor(opts.overlap ?? OCR_BATCH_OVERLAP)), size - 1);
  const stride = size - overlap;

  const sorted = [...new Set(pages)]
    .filter((p) => Number.isInteger(p) && p >= 1)
    .sort((a, b) => a - b);
  if (sorted.length === 0) return [];

  const batches: PageBatch[] = [];
  for (let start = 0; start < sorted.length; start += stride) {
    const batch = sorted.slice(start, start + size);
    // 마지막 묶음이 앞 묶음에 이미 다 들어 있으면 만들지 않는다
    // (겹침 때문에 생기는 '같은 쪽만 다시 읽는' 묶음 = ChatGPT 한 번 낭비)
    const prev = batches[batches.length - 1];
    if (prev && batch.every((p) => prev.includes(p))) break;
    batches.push(batch);
    if (start + size >= sorted.length) break;
  }
  return batches;
}

/**
 * 묶음이 늘어난 만큼 실제로 읽는 쪽이 겹친다 — 사람에게 알릴 문구를 만든다.
 * @param batches - 나눈 묶음
 * @returns '30쪽을 15묶음으로 읽어요' 같은 안내
 */
export function batchPlanSummary(batches: PageBatch[]): string {
  const pageCount = new Set(batches.flat()).size;
  return `${pageCount}쪽을 ${batches.length}묶음으로 읽어요`;
}
