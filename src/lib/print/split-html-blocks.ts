/**
 * 개념지 본문 HTML(TipTap 변환 결과)을 페이지네이션 블록 단위로 쪼갠다.
 *
 * 블록 = 최상위 자식 요소 1개. 한 페이지에 안 들어가는 표는 `splitTableByRows` 로
 * 행 단위 조각 테이블로 다시 쪼갠다(실측 행 높이·열 너비는 호출부가 넘긴다).
 * 어디서 잘라도 되는지(rowspan 경계)·어디서 자를지는 `table-row-plan.ts` 의 순수 계산이 맡는다.
 */

import { colgroupFromWidths } from './table-col-fit';
import { cellsOf, createHost, parseRowSpan, rootTable } from './table-dom';
import { legalCutFlags, planRowChunks, type RowRange } from './table-row-plan';

/** 조각 테이블 식별용 클래스 — 인접 조각의 테두리 겹침 보정에 쓴다 */
export const TABLE_CHUNK_CLASS = 'sheet-table-chunk';

/** 짝수 행 줄무늬 표시. 표를 쪼개면 nth-child 가 리셋되므로 원본 인덱스를 속성으로 박는다 */
export const ROW_EVEN_ATTR = 'data-row-even';

/** 조각마다 반복할 제목 행 최대 개수 — 2행 병합 제목(대분류/소분류)까지 */
const MAX_HEADER_ROWS = 2;

/**
 * 페이지의 남은 자리를 채울 때 앞 조각에 있어야 할 최소 본문 행 수.
 * 한 행만 걸치면 페이지 바닥에 제목+한 줄만 남아 오히려 보기 나쁘다 — 그럴 바엔 다음 장에서 시작한다.
 */
export const MIN_LEAD_BODY_ROWS = 2;

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

const stripSpaces = (text: string) => text.replace(/\s+/g, '');

/**
 * 단계 변환이 텍스트를 지운 개념 표시 — 1·2단계 박스 묶음과 3단계 밑줄.
 * 2단계 박스는 빈 span 이고 3단계 밑줄은 `&nbsp;` 뿐이라(`\s` 가 NBSP 까지 지운다)
 * 텍스트만 보면 개념어로만 이뤄진 제목 행이 '빈 행' 으로 오판된다.
 */
const BLANK_MARK_SELECTOR = '.eb-blank-run, .eb-stage3-blank';

function countBlankMarks(el: Element): number {
  return el.querySelectorAll(BLANK_MARK_SELECTOR).length;
}

function isEmptyCell(cell: Element): boolean {
  return stripSpaces(cell.textContent ?? '') === '' && countBlankMarks(cell) === 0;
}

/**
 * 셀 내용 전체가 <strong> 안에 있는가 (빈 셀은 false).
 * 텍스트와 개념 표시 개수를 따로 비교한다 — 이어 붙여 비교하면 굵은 조각이 여러 개일 때
 * 순서가 어긋나 굵은 제목을 놓친다.
 */
function isStrongOnly(cell: Element): boolean {
  const text = stripSpaces(cell.textContent ?? '');
  const marks = countBlankMarks(cell);
  if (text === '' && marks === 0) return false;
  const strongs = Array.from(cell.querySelectorAll('strong'));
  const strongText = stripSpaces(strongs.map((el) => el.textContent ?? '').join(''));
  const strongMarks = strongs.reduce((total, el) => total + countBlankMarks(el), 0);
  return strongText === text && strongMarks === marks;
}

/**
 * 제목 행 후보: 전부 <th> 이거나, 비지 않은 셀이 전부 굵은 글씨.
 * 편집기가 표를 헤더 행 없이 넣어(`withHeaderRow: false`) 제목이 보통 `<td><strong>` 이라 th 만 보면 놓친다.
 */
function isHeaderLikeRow(row: HTMLTableRowElement): boolean {
  const cells = cellsOf(row);
  if (cells.length === 0) return false;
  if (isExplicitHeaderRow(row)) return true;
  const filled = cells.filter((cell) => !isEmptyCell(cell));
  return filled.length > 0 && filled.every(isStrongOnly);
}

/**
 * 작성자가 제목이라고 **명시한** 행 — 셀이 전부 `<th>` 이거나 `<thead>` 안에 있다.
 * 굵은 글씨 판정과 달리 추측이 아니므로 여러 행을 이어 가져와도 안전하다.
 */
function isExplicitHeaderRow(row: HTMLTableRowElement | undefined): boolean {
  if (!row) return false;
  if (row.parentElement?.tagName === 'THEAD') return true;
  const cells = cellsOf(row);
  return cells.length > 0 && cells.every((cell) => cell.tagName === 'TH');
}

/**
 * 앞에서부터 제목 행 개수를 센다.
 *
 * 조각마다 반복해야 하므로 제목 묶음의 끝은 **합법 절단점이어야 한다** — 제목 셀이 본문으로
 * rowspan 되어 있으면 그 자리에서 끊을 수 없어 반복할 수 없다. 그래서 합법 절단점으로
 * 끝나는 마지막 후보(`best`)만 확정하고, 더 가져가려다 실패해도 거기로 후퇴한다.
 *
 * 다음 행으로 이어 가는 것은 그 행이 **명시 제목(th/thead)** 일 때만이다. 이 규칙 하나가
 * 두 가지를 동시에 막는다 — (1) 굵은 데이터 행이 제목으로 승격되는 것, (2) 제목 셀이
 * rowspan 으로 뻗은 첫 데이터 행이 제목 묶음에 끌려와 매 페이지 반복되는 것.
 * 반대로 '묶음명 + 열 이름' 처럼 둘째 행도 th 인 2행 제목은 끝까지 가져와야 한다 —
 * 안 그러면 둘째 행이 본문으로 밀려 2페이지부터 열 이름이 빠진다.
 */
function detectHeaderRows(rows: HTMLTableRowElement[], legalCut: boolean[]): number {
  /** 합법 절단점으로 끝나는 마지막 제목 행 수. 여기까지는 언제나 반복할 수 있다 */
  let best = 0;
  let count = 0;
  while (count < rows.length - 1 && count < MAX_HEADER_ROWS && isHeaderLikeRow(rows[count])) {
    count++;
    if (legalCut[count]) best = count;
    if (!isExplicitHeaderRow(rows[count])) break;
  }
  return best;
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

/** 조각 계획 입력 */
export interface SplitTableOptions {
  /** 한 조각이 쓸 수 있는 최대 높이(px) */
  capacity: number;
  /**
   * 첫 조각만의 용량 — 지금 페이지에 남은 자리. 없으면 `capacity` 와 같다.
   * 이 자리에 제목+본문 2행도 못 넣으면 새 페이지에서 시작하는 계획으로 되돌린다.
   */
  firstCapacity?: number;
  /** 기준 행의 셀 실측 폭 — 표에 colgroup 이 없을 때 조각의 열 폭을 같은 비율로 고정한다 */
  colWidths?: readonly number[];
}

/**
 * 앞 조각을 페이지의 남은 자리에 맞춰 계획한다.
 * 남은 자리가 없거나, 계획한 앞 조각이 그 자리를 넘거나(병합 묶음이 커서), 본문 행이 너무 적으면
 * 페이지 바닥에 고아 행만 남으므로 새 페이지에서 시작하는 계획으로 되돌린다.
 */
function planRanges(
  heights: readonly number[],
  legalCut: readonly boolean[],
  capacity: number,
  leadCapacity: number,
): RowRange[] {
  if (leadCapacity <= 0 || leadCapacity >= capacity) return planRowChunks(heights, legalCut, capacity);
  const ranges = planRowChunks(heights, legalCut, capacity, leadCapacity);
  const lead = ranges[0];
  const leadRows = lead.end - lead.start + 1;
  const leadHeight = sum(heights.slice(lead.start, lead.end + 1));
  if (ranges.length > 1 && leadRows >= MIN_LEAD_BODY_ROWS && leadHeight <= leadCapacity) return ranges;
  return planRowChunks(heights, legalCut, capacity);
}

/**
 * 표를 행 단위로 쪼개 각각 용량 안에 들어가는 조각 테이블 배열로 만든다.
 *
 * rowspan 으로 묶인 행은 가르지 않고 묶음 경계에서만 자른다(끊으면 다음 조각에서 열이 밀린다).
 * 묶음 하나가 용량보다 크면 그 조각은 용량을 넘긴 채 나가고 인쇄 엔진이 축소해서 담는다.
 * 쪼갤 수 없으면 **입력 문자열을 그대로** 돌려준다 — 호출부는 조각 수 > 1 일 때만 상태를 갱신하므로
 * 이것이 재분할 루프의 종료 조건이다.
 *
 * @param tableHtml 표 하나의 HTML (블록 루트가 표가 아니면 손대지 않는다)
 * @param rowHeights 표의 모든 `tr` 실측 높이 (문서 순서, 제목 행 포함)
 */
export function splitTableByRows(
  tableHtml: string,
  rowHeights: readonly number[],
  { capacity, firstCapacity, colWidths }: SplitTableOptions,
): string[] {
  const host = createHost(tableHtml);
  const table = host ? rootTable(host) : null;
  if (!table) return [tableHtml];

  const allRows = Array.from(table.querySelectorAll('tr'));
  if (allRows.length <= 1) return [tableHtml];

  const legalCut = legalCutFlags(allRows.map((row) => cellsOf(row).map(parseRowSpan)));
  const headerCount = detectHeaderRows(allRows, legalCut);
  const headerHeight = sum(rowHeights.slice(0, headerCount));
  const chunkCapacity = capacity - headerHeight;
  if (chunkCapacity <= 0) return [tableHtml];

  const bodyHeights = rowHeights.slice(headerCount);
  const bodyLegal = legalCut.slice(headerCount);
  const leadCapacity = firstCapacity === undefined ? chunkCapacity : firstCapacity - headerHeight;
  const ranges = planRanges(bodyHeights, bodyLegal, chunkCapacity, leadCapacity);
  if (ranges.length <= 1) return [tableHtml];

  const headerRows = allRows.slice(0, headerCount);
  const bodyRows = allRows.slice(headerCount);
  // 열 폭 맞춤이 박아 둔 colgroup 이 있으면 그것을 복제한다 — 조각 열 폭이 원본과 정확히 같아
  // 실측한 행 높이가 조각에서도 그대로다. 맞춤에 실패한 표만 실측 셀 폭으로 고정한다
  const existingColgroup = table.querySelector('colgroup');
  const widthColgroup = existingColgroup ? null : colgroupFromWidths(colWidths);
  const colgroup = existingColgroup ? (existingColgroup.cloneNode(true) as HTMLElement) : widthColgroup;

  return ranges.map((range) =>
    buildChunk(table, colgroup, headerRows, bodyRows.slice(range.start, range.end + 1), widthColgroup !== null),
  );
}
