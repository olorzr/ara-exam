/**
 * 인쇄 측정 컨테이너 안의 표를 실측한다 (DOM 읽기 전용).
 *
 * `splitTableByRows` 와 같은 `tr` 선택자를 써야 행 인덱스가 1:1 로 맞는다.
 */

import { rowColumnCount } from './sheet-columns';

/** 표의 모든 행 높이 (문서 순서, 제목 행 포함) */
export function measureRowHeights(table: HTMLTableElement): number[] {
  return Array.from(table.querySelectorAll('tr')).map((row) => row.getBoundingClientRect().height);
}

/**
 * 조각 표의 열 폭을 고정할 기준 — 모든 셀이 colspan 1 이고 셀 수가 표의 열 수와 같은 첫 행의 셀 폭.
 * 그런 행이 없으면(모든 행에 병합 셀이 있음) null 을 돌려주고 조각은 auto 레이아웃으로 남는다.
 */
export function measureColumnWidths(table: HTMLTableElement): number[] | null {
  const rows = Array.from(table.querySelectorAll('tr'));
  const columnCount = rows.reduce((max, row) => Math.max(max, rowColumnCount(row)), 0);
  const reference = rows.find(
    (row) => row.children.length === columnCount && rowColumnCount(row) === columnCount,
  );
  if (!reference) return null;
  return Array.from(reference.children).map((cell) => cell.getBoundingClientRect().width);
}
