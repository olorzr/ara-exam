/**
 * 표를 행 단위로 쪼갤 때의 순수 계산.
 *
 * DOM 을 만지지 않는다 — rowspan 목록과 실측 행 높이만 받아
 * "어디서 잘라도 되는가"(legalCutFlags) 와 "어디서 자를 것인가"(planRowChunks) 를 돌려준다.
 */

/** HTML 규격상 rowspan="0" 은 표 끝까지 뻗는다 — 그 뒤로는 어디서도 자를 수 없다 */
export const ROWSPAN_TO_END = 0;

/** 조각 하나가 차지하는 본문 행 범위 (양끝 포함) */
export interface RowRange {
  start: number;
  end: number;
}

/**
 * 행마다 "이 행 앞에서 잘라도 되는가"를 계산한다.
 *
 * 이전 행의 셀이 이 행까지 세로로 뻗어 있으면(rowspan) 여기서 끊을 수 없다 —
 * 끊으면 다음 조각에 그 셀이 없어 나머지 셀이 앞 열로 밀린다. colspan 은 무관하다.
 *
 * @param rowSpans rowSpans[r] = r 행 셀들의 rowspan 값 목록
 * @returns flags[r] — r 행 앞 절단 가능 여부. flags[0] 은 항상 true
 */
export function legalCutFlags(rowSpans: ReadonlyArray<ReadonlyArray<number>>): boolean[] {
  let reach = -1;
  return rowSpans.map((spans, rowIndex) => {
    // 이 행의 셀을 반영하기 전에 판정한다 — 이전 행들이 여기까지 뻗었는지가 기준
    const legal = reach < rowIndex;
    spans.forEach((span) => {
      const end = span === ROWSPAN_TO_END ? Number.POSITIVE_INFINITY : rowIndex + span - 1;
      reach = Math.max(reach, end);
    });
    return legal;
  });
}

function sumRange(values: readonly number[], from: number, to: number): number {
  let total = 0;
  for (let i = from; i < to; i++) total += values[i] ?? 0;
  return total;
}

/**
 * 실측 행 높이로 조각 범위를 그리디로 정한다.
 *
 * 다음 행을 더하면 용량을 넘길 때 가장 최근의 합법 절단점으로 물러나 자른다.
 * 조각 안에 합법 절단점이 없으면(병합 묶음이 용량보다 큼) 용량을 넘겨서라도 이어 붙인다 —
 * 그 조각은 호출부(인쇄 엔진)가 축소해서 담는다.
 *
 * @param heights 본문 행 높이(px), 문서 순서
 * @param legalCut legalCutFlags 결과 (heights 와 같은 길이)
 * @param capacity 한 조각이 쓸 수 있는 최대 높이(px)
 * @param firstCapacity 0행에서 시작하는 첫 조각만의 용량 — 페이지의 남은 자리를 채울 때 더 작다
 */
export function planRowChunks(
  heights: readonly number[],
  legalCut: readonly boolean[],
  capacity: number,
  firstCapacity: number = capacity,
): RowRange[] {
  if (heights.length === 0) return [];

  const chunks: RowRange[] = [];
  let start = 0;
  let used = 0;
  /** 현재 조각 안의 가장 최근 합법 절단점. start 보다 클 때만 후보다 */
  let lastLegal = 0;
  const capacityOf = (chunkStart: number) => (chunkStart === 0 ? firstCapacity : capacity);

  for (let row = 0; row < heights.length; row++) {
    if (row > start && legalCut[row]) lastLegal = row;
    const height = heights[row] ?? 0;

    if (row > start && used + height > capacityOf(start) && lastLegal > start) {
      chunks.push({ start, end: lastLegal - 1 });
      // lastLegal..row-1 행은 새 조각으로 넘어간다
      used = sumRange(heights, lastLegal, row);
      start = lastLegal;
    }
    used += height;
  }
  chunks.push({ start, end: heights.length - 1 });

  return chunks;
}
