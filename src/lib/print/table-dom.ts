/**
 * 표 HTML 을 다루는 DOM 헬퍼 — 블록 분할·열 폭 맞춤·실측이 공용한다.
 *
 * 브라우저가 없으면(SSR) 전부 null 을 돌려주고 호출부가 입력을 그대로 둔다.
 */

import { ROWSPAN_TO_END } from './table-row-plan';
import type { CellSpan } from './table-grid';

/** HTML 문자열을 임시 컨테이너에 파싱한다. document 가 없으면 null */
export function createHost(html: string): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const host = document.createElement('div');
  host.innerHTML = html;
  return host;
}

/**
 * 블록 루트가 표 자체일 때만 그 표를 돌려준다.
 * blockquote/li 안의 표를 손대면 래퍼와 형제 내용이 사라지므로 루트가 아니면 null.
 */
export function rootTable(host: HTMLElement): HTMLTableElement | null {
  const first = host.firstElementChild;
  if (host.children.length !== 1 || !(first instanceof HTMLTableElement)) return null;
  return first;
}

/** 행의 직계 셀(td/th)만 — 다른 자식이 섞여 있어도 무시한다 */
export function cellsOf(row: Element): Element[] {
  return Array.from(row.children).filter((el) => el.tagName === 'TD' || el.tagName === 'TH');
}

/** rowspan 속성 → 숫자. 없거나 이상하면 1. "0" 은 HTML 규격대로 표 끝까지(ROWSPAN_TO_END) */
export function parseRowSpan(cell: Element): number {
  const raw = cell.getAttribute('rowspan');
  if (raw === null) return 1;
  const value = Number.parseInt(raw, 10);
  return Number.isNaN(value) || value < 0 ? 1 : value;
}

/** colspan 속성 → 숫자. 없거나 이상하면 1 */
export function parseColSpan(cell: Element): number {
  const value = Number.parseInt(cell.getAttribute('colspan') ?? '', 10);
  return Number.isNaN(value) || value < 1 ? 1 : value;
}

/** 표의 모든 행(문서 순서)과 행별 셀 span — 격자 계산 입력 */
export function tableCellSpans(table: HTMLTableElement): { rows: HTMLTableRowElement[]; spans: CellSpan[][] } {
  const rows = Array.from(table.querySelectorAll('tr'));
  const spans = rows.map((row) =>
    cellsOf(row).map((cell) => ({ colSpan: parseColSpan(cell), rowSpan: parseRowSpan(cell) })),
  );
  return { rows, spans };
}

export { ROWSPAN_TO_END };

/** 블록 루트가 표일 때 그 표의 행 수. 표가 아니면 0 */
export function tableRowCount(html: string): number {
  const host = createHost(html);
  const table = host ? rootTable(host) : null;
  return table ? table.querySelectorAll('tr').length : 0;
}
