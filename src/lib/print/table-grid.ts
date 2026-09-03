/**
 * 표 격자 걷기 (순수 계산).
 *
 * rowspan/colspan 이 섞인 표에서 "이 셀은 몇 번째 열에서 시작하는가"를 계산한다.
 * DOM 을 만지지 않는다 — 행별 셀 span 목록만 받는다.
 */

import { ROWSPAN_TO_END } from './table-row-plan';

/** 셀 하나의 병합 범위 */
export interface CellSpan {
  colSpan: number;
  rowSpan: number;
}

/**
 * 행별 셀 span → 행별 '셀 시작 열 인덱스'.
 *
 * 위 행의 셀이 rowspan 으로 내려와 차지한 자리는 건너뛴다(HTML 표 격자 규칙).
 * rowspan 0 은 표 끝까지 뻗은 것으로 본다.
 *
 * @param rows rows[r][c] = r 행 c 번째 셀의 span
 * @returns columns[r][c] = 그 셀이 시작하는 열 인덱스 (0-based)
 */
export function cellColumnIndices(rows: ReadonlyArray<ReadonlyArray<CellSpan>>): number[][] {
  const occupied = rows.map(() => new Set<number>());
  return rows.map((cells, rowIndex) => {
    let cursor = 0;
    return cells.map(({ colSpan, rowSpan }) => {
      while (occupied[rowIndex].has(cursor)) cursor++;
      const start = cursor;
      const width = Math.max(1, colSpan);
      const lastRow =
        rowSpan === ROWSPAN_TO_END ? rows.length - 1 : Math.min(rows.length - 1, rowIndex + Math.max(1, rowSpan) - 1);
      for (let below = rowIndex + 1; below <= lastRow; below++) {
        for (let column = start; column < start + width; column++) occupied[below].add(column);
      }
      cursor = start + width;
      return start;
    });
  });
}

/** 격자의 열 수 — 어느 행에서든 가장 멀리 닿은 열 끝 */
export function gridColumnCount(
  rows: ReadonlyArray<ReadonlyArray<CellSpan>>,
  columns: ReadonlyArray<ReadonlyArray<number>>,
): number {
  return rows.reduce((max, cells, rowIndex) => {
    const rowEnd = cells.reduce(
      (end, cell, cellIndex) => Math.max(end, (columns[rowIndex]?.[cellIndex] ?? 0) + Math.max(1, cell.colSpan)),
      0,
    );
    return Math.max(max, rowEnd);
  }, 0);
}
