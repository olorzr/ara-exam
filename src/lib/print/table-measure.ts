/**
 * 인쇄 측정 컨테이너 안의 표를 실측한다 (DOM 읽기).
 *
 * `splitTableByRows` 와 같은 `tr` 선택자를 써야 행 인덱스가 1:1 로 맞는다.
 */

import { rowColumnCount } from './sheet-columns';
import { cellColumnIndices, gridColumnCount } from './table-grid';
import { cellsOf, createHost, rootTable, tableCellSpans } from './table-dom';

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

/**
 * 열마다 "줄바꿈 없이 다 쓰면 얼마나 넓은가"(max-content)를 잰다.
 *
 * 표 클론을 `width: max-content` 래퍼에 담아 측정 컨테이너에 잠깐 붙였다 뗀다. 래퍼가 없으면
 * 절대배치의 shrink-to-fit 이 컨테이너 폭에 걸려 접힌 폭이 나오고, 표의 `width` 를 `auto` 로
 * 되돌리지 않으면 `table-layout: fixed` + 100% 가 남아 이미 정해진 폭을 그대로 읽는다.
 *
 * @param tableHtml 표 하나의 HTML (블록 루트가 표가 아니면 null)
 * @param root 측정 컨테이너 — 시트와 같은 타이포그래피 스코프여야 폭이 맞는다
 * @param bodyClass 시트 본문 래퍼 클래스 (표 CSS 가 이 클래스 아래에만 걸려 있다)
 * @returns 열별 max-content 폭(px). 잴 수 없는 열이 있으면 null
 */
export function measureMaxContentWidths(
  tableHtml: string,
  root: HTMLElement,
  bodyClass: string,
): number[] | null {
  const host = createHost(tableHtml);
  const table = host ? rootTable(host) : null;
  if (!table) return null;

  table.querySelectorAll('colgroup').forEach((el) => el.remove());
  table.style.tableLayout = '';
  table.style.width = 'auto';

  const probe = document.createElement('div');
  probe.className = bodyClass;
  probe.style.cssText = 'position:absolute;left:0;top:0;width:max-content;pointer-events:none';
  probe.appendChild(table);
  root.appendChild(probe);
  try {
    return readColumnWidths(table);
  } finally {
    probe.remove();
  }
}

/** 열마다 colspan 1 인 셀 하나를 찾아 그 폭을 읽는다. 한 열이라도 못 찾으면 null */
function readColumnWidths(table: HTMLTableElement): number[] | null {
  const { rows, spans } = tableCellSpans(table);
  const columns = cellColumnIndices(spans);
  const columnCount = gridColumnCount(spans, columns);
  if (columnCount === 0) return null;

  const widths = new Array<number>(columnCount).fill(0);
  const found = new Array<boolean>(columnCount).fill(false);
  rows.forEach((row, rowIndex) => {
    cellsOf(row).forEach((cell, cellIndex) => {
      const column = columns[rowIndex][cellIndex];
      if (spans[rowIndex][cellIndex].colSpan !== 1 || found[column]) return;
      const width = cell.getBoundingClientRect().width;
      if (!(width > 0)) return;
      widths[column] = width;
      found[column] = true;
    });
  });
  return found.every(Boolean) ? widths : null;
}
