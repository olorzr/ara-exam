/**
 * 개념지 본문 HTML(TipTap 변환 결과)을 페이지네이션 블록 단위로 쪼갠다.
 *
 * 블록 = 최상위 자식 요소 1개. 한 페이지에 안 들어가는 표는 `splitTableByRows` 로
 * 행 단위 조각 테이블로 다시 쪼갠다(실측 행 높이·열 너비는 호출부가 넘긴다).
 * 어디서 잘라도 되는지(rowspan 경계)·어디서 자를지는 `table-row-plan.ts` 의 순수 계산이 맡는다.
 */

import { legalCutFlags, planRowChunks } from './table-row-plan';

/** 조각 테이블 식별용 클래스 — 인접 조각의 테두리 겹침 보정에 쓴다 */
export const TABLE_CHUNK_CLASS = 'sheet-table-chunk';

/** 짝수 행 줄무늬 표시. 표를 쪼개면 nth-child 가 리셋되므로 원본 인덱스를 속성으로 박는다 */
export const ROW_EVEN_ATTR = 'data-row-even';

/** 조각마다 반복할 제목 행 최대 개수 — 2행 병합 제목(대분류/소분류)까지 */
const MAX_HEADER_ROWS = 2;

/** 조각 열 너비 퍼센트의 소수 자릿수 */
const COL_WIDTH_DECIMALS = 3;

function createHost(html: string): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const host = document.createElement('div');
  host.innerHTML = html;
  return host;
}

/** 표의 모든 행에 원본 순서 기반 줄무늬 표시를 남긴다 (nth-child 리셋 대비) */
function markRowStripes(host: HTMLElement): void {
  host.querySelectorAll('table').forEach((table) => {
    const rows = Array.from(table.querySelectorAll('tr'));
    rows.forEach((row, idx) => {
      // 기존 CSS 의 tr:nth-child(even) 와 같은 행(1-based 짝수)에 표시
      if (idx % 2 === 1) row.setAttribute(ROW_EVEN_ATTR, '');
      else row.removeAttribute(ROW_EVEN_ATTR);
    });
  });
}

/**
 * HTML 을 최상위 요소 단위 블록 배열로 분해한다.
 * 브라우저가 없으면(SSR) 통째로 한 블록으로 돌려준다 — 클라이언트에서 다시 계산된다.
 */
export function splitHtmlBlocks(html: string): string[] {
  const host = createHost(html);
  if (!host) return html.trim() ? [html] : [];
  markRowStripes(host);
  return Array.from(host.children)
    .map((el) => el.outerHTML)
    .filter((chunk) => chunk.trim().length > 0);
}

/** 블록 루트가 표 자체일 때만 돌려준다 — blockquote/li 안의 표를 쪼개면 래퍼와 형제 내용이 사라진다 */
function rootTable(host: HTMLElement): HTMLTableElement | null {
  const first = host.firstElementChild;
  if (host.children.length !== 1 || !(first instanceof HTMLTableElement)) return null;
  return first;
}

function cellsOf(row: HTMLTableRowElement): Element[] {
  return Array.from(row.children).filter((el) => el.tagName === 'TD' || el.tagName === 'TH');
}

/** rowspan 속성 → 숫자. 없거나 이상하면 1. "0" 은 HTML 규격대로 표 끝까지(ROWSPAN_TO_END) */
function parseRowSpan(cell: Element): number {
  const raw = cell.getAttribute('rowspan');
  if (raw === null) return 1;
  const value = Number.parseInt(raw, 10);
  return Number.isNaN(value) || value < 0 ? 1 : value;
}

const stripSpaces = (text: string) => text.replace(/\s+/g, '');

function isEmptyCell(cell: Element): boolean {
  return stripSpaces(cell.textContent ?? '') === '';
}

/** 셀 텍스트 전체가 <strong> 안에 있는가 (빈 셀은 false) */
function isStrongOnly(cell: Element): boolean {
  const text = stripSpaces(cell.textContent ?? '');
  if (text === '') return false;
  const strong = Array.from(cell.querySelectorAll('strong'))
    .map((el) => el.textContent ?? '')
    .join('');
  return stripSpaces(strong) === text;
}

/**
 * 제목 행 후보: 전부 <th> 이거나, 비지 않은 셀이 전부 굵은 글씨.
 * 편집기가 표를 헤더 행 없이 넣어(`withHeaderRow: false`) 제목이 보통 `<td><strong>` 이라 th 만 보면 놓친다.
 */
function isHeaderLikeRow(row: HTMLTableRowElement): boolean {
  const cells = cellsOf(row);
  if (cells.length === 0) return false;
  if (cells.every((cell) => cell.tagName === 'TH')) return true;
  const filled = cells.filter((cell) => !isEmptyCell(cell));
  return filled.length > 0 && filled.every(isStrongOnly);
}

/**
 * 앞에서부터 제목 행 개수를 센다.
 * 조각마다 반복해야 하므로 제목 묶음의 끝은 합법 절단점이어야 한다 — 제목 셀이 본문으로
 * rowspan 되어 있으면 반복할 수 없어 0 을 돌려준다. 첫 합법 절단점에서 멈춰 굵은 데이터 행을 끌어들이지 않는다.
 */
function detectHeaderRows(rows: HTMLTableRowElement[], legalCut: boolean[]): number {
  let count = 0;
  while (count < rows.length - 1 && count < MAX_HEADER_ROWS && isHeaderLikeRow(rows[count])) {
    count++;
    if (legalCut[count]) break;
  }
  return legalCut[count] ? count : 0;
}

/**
 * 실측 열 너비를 퍼센트 colgroup 으로 만든다.
 * 조각은 각자 독립된 표라 auto 레이아웃이면 페이지마다 열 폭이 흔들리므로 같은 비율로 고정한다.
 */
function colgroupFromWidths(colWidths?: readonly number[]): HTMLElement | null {
  if (!colWidths || colWidths.length === 0) return null;
  const total = colWidths.reduce((sum, width) => sum + width, 0);
  if (total <= 0) return null;
  const colgroup = document.createElement('colgroup');
  colWidths.forEach((width) => {
    const col = document.createElement('col');
    col.style.width = `${((width / total) * 100).toFixed(COL_WIDTH_DECIMALS)}%`;
    colgroup.appendChild(col);
  });
  return colgroup;
}

function buildChunk(
  table: HTMLTableElement,
  colgroup: HTMLElement | null,
  headerRows: HTMLTableRowElement[],
  rows: HTMLTableRowElement[],
  fixedLayout: boolean,
): string {
  const chunk = table.cloneNode(false) as HTMLTableElement;
  chunk.classList.add(TABLE_CHUNK_CLASS);
  if (fixedLayout) chunk.style.tableLayout = 'fixed';
  if (colgroup) chunk.appendChild(colgroup.cloneNode(true));
  const body = document.createElement('tbody');
  headerRows.forEach((row) => body.appendChild(row.cloneNode(true)));
  rows.forEach((row) => body.appendChild(row.cloneNode(true)));
  chunk.appendChild(body);
  return chunk.outerHTML;
}

const sum = (values: readonly number[]) => values.reduce((acc, value) => acc + value, 0);

/**
 * 표를 행 단위로 쪼개 각각 `capacity` 안에 들어가는 조각 테이블 배열로 만든다.
 *
 * rowspan 으로 묶인 행은 가르지 않고 묶음 경계에서만 자른다(끊으면 다음 조각에서 열이 밀린다).
 * 묶음 하나가 용량보다 크면 그 조각은 용량을 넘긴 채 나가고 인쇄 엔진이 축소해서 담는다.
 * 쪼갤 수 없으면 **입력 문자열을 그대로** 돌려준다 — 호출부는 조각 수 > 1 일 때만 상태를 갱신하므로
 * 이것이 재분할 루프의 종료 조건이다.
 *
 * @param tableHtml 표 하나의 HTML (블록 루트가 표가 아니면 손대지 않는다)
 * @param rowHeights 표의 모든 `tr` 실측 높이 (문서 순서, 제목 행 포함)
 * @param capacity 한 조각이 쓸 수 있는 최대 높이(px)
 * @param colWidths 기준 행의 셀 실측 폭 — 있으면 조각의 열 폭을 같은 비율로 고정한다
 */
export function splitTableByRows(
  tableHtml: string,
  rowHeights: readonly number[],
  capacity: number,
  colWidths?: readonly number[],
): string[] {
  const host = createHost(tableHtml);
  const table = host ? rootTable(host) : null;
  if (!table) return [tableHtml];

  const allRows = Array.from(table.querySelectorAll('tr'));
  if (allRows.length <= 1) return [tableHtml];

  const legalCut = legalCutFlags(allRows.map((row) => cellsOf(row).map(parseRowSpan)));
  const headerCount = detectHeaderRows(allRows, legalCut);
  const chunkCapacity = capacity - sum(rowHeights.slice(0, headerCount));
  if (chunkCapacity <= 0) return [tableHtml];

  const ranges = planRowChunks(rowHeights.slice(headerCount), legalCut.slice(headerCount), chunkCapacity);
  if (ranges.length <= 1) return [tableHtml];

  const headerRows = allRows.slice(0, headerCount);
  const bodyRows = allRows.slice(headerCount);
  const widthColgroup = colgroupFromWidths(colWidths);
  const existingColgroup = table.querySelector('colgroup');
  const colgroup = widthColgroup ?? (existingColgroup ? (existingColgroup.cloneNode(true) as HTMLElement) : null);

  return ranges.map((range) =>
    buildChunk(table, colgroup, headerRows, bodyRows.slice(range.start, range.end + 1), widthColgroup !== null),
  );
}
