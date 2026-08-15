/**
 * 개념지 본문 HTML(TipTap 변환 결과)을 페이지네이션 블록 단위로 쪼갠다.
 *
 * 블록 = 최상위 자식 요소 1개. 한 페이지에 안 들어가는 표는 `splitTableByRows` 로
 * 행 단위 조각 테이블로 다시 쪼갠다(실측 행 높이는 호출부가 넘긴다).
 */

/** 조각 테이블 식별용 클래스 — 인접 조각의 테두리 겹침 보정에 쓴다 */
export const TABLE_CHUNK_CLASS = 'sheet-table-chunk';

/** 짝수 행 줄무늬 표시. 표를 쪼개면 nth-child 가 리셋되므로 원본 인덱스를 속성으로 박는다 */
export const ROW_EVEN_ATTR = 'data-row-even';

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

/** 첫 행이 전부 th 면 헤더 행으로 보고 조각마다 반복한다 */
function isHeaderRow(row: HTMLTableRowElement): boolean {
  const cells = Array.from(row.children);
  return cells.length > 0 && cells.every((cell) => cell.tagName === 'TH');
}

function buildChunk(
  table: HTMLTableElement,
  colgroup: HTMLElement | null,
  headerRow: HTMLTableRowElement | null,
  rows: HTMLTableRowElement[],
): string {
  const chunk = table.cloneNode(false) as HTMLTableElement;
  chunk.classList.add(TABLE_CHUNK_CLASS);
  if (colgroup) chunk.appendChild(colgroup.cloneNode(true));
  const body = document.createElement('tbody');
  if (headerRow) body.appendChild(headerRow.cloneNode(true));
  rows.forEach((row) => body.appendChild(row.cloneNode(true)));
  chunk.appendChild(body);
  return chunk.outerHTML;
}

/**
 * 표를 행 단위로 쪼개 각각 `capacity` 안에 들어가는 조각 테이블 배열로 만든다.
 *
 * @param tableHtml 표 하나의 HTML
 * @param rowHeights 표의 모든 `tr` 실측 높이 (문서 순서, 헤더 행 포함)
 * @param capacity 한 조각이 쓸 수 있는 최대 높이(px)
 */
export function splitTableByRows(tableHtml: string, rowHeights: number[], capacity: number): string[] {
  const host = createHost(tableHtml);
  const table = host?.querySelector('table');
  if (!table) return [tableHtml];

  const allRows = Array.from(table.querySelectorAll('tr')) as HTMLTableRowElement[];
  if (allRows.length <= 1) return [tableHtml];

  const colgroup = table.querySelector('colgroup');
  const hasHeader = isHeaderRow(allRows[0]);
  const headerRow = hasHeader ? allRows[0] : null;
  const headerHeight = hasHeader ? (rowHeights[0] ?? 0) : 0;
  const bodyRows = hasHeader ? allRows.slice(1) : allRows;
  const bodyHeights = hasHeader ? rowHeights.slice(1) : rowHeights;

  const chunkCapacity = capacity - headerHeight;
  if (chunkCapacity <= 0) return [tableHtml];

  const chunks: string[] = [];
  let current: HTMLTableRowElement[] = [];
  let used = 0;

  bodyRows.forEach((row, idx) => {
    const height = bodyHeights[idx] ?? 0;
    if (current.length > 0 && used + height > chunkCapacity) {
      chunks.push(buildChunk(table, colgroup, headerRow, current));
      current = [];
      used = 0;
    }
    current.push(row);
    used += height;
  });
  if (current.length > 0) chunks.push(buildChunk(table, colgroup, headerRow, current));

  return chunks.length > 0 ? chunks : [tableHtml];
}
