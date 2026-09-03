/**
 * 개념지 시트의 단(컬럼) 수 결정.
 *
 * 글자 수가 많으면 2단으로 읽기 좋게 하지만, 열이 많은 표는 2단 폭(≈328px)에 담기지 않으므로
 * 그런 표가 하나라도 있으면 시트 전체를 1단으로 되돌린다.
 */

/** 1단 최대 글자 수 — 초과 시 2단 레이아웃 */
export const SINGLE_COL_CHAR_THRESHOLD = 300;

/** 이 열 수 이상인 표가 있으면 2단을 포기하고 1단으로 그린다 */
export const WIDE_TABLE_MIN_COLUMNS = 3;

function parseSpan(raw: string | null): number {
  const value = Number.parseInt(raw ?? '', 10);
  return Number.isNaN(value) || value < 1 ? 1 : value;
}

/** 한 행이 차지하는 열 수 (직계 td/th 의 colspan 합). 잘못된 colspan 은 1 로 센다 */
export function rowColumnCount(row: Element): number {
  return Array.from(row.children).reduce((sum, cell) => {
    if (cell.tagName !== 'TD' && cell.tagName !== 'TH') return sum;
    return sum + parseSpan(cell.getAttribute('colspan'));
  }, 0);
}

/**
 * HTML 안의 모든 표 중 가장 넓은 표의 열 수.
 * 첫 행에는 위에서 뻗어 오는 셀이 없으므로 행별 colspan 합의 최댓값이 곧 열 수다.
 * 표가 없거나 DOM 이 없으면(SSR) 0.
 */
export function maxTableColumns(html: string): number {
  if (typeof document === 'undefined') return 0;
  const host = document.createElement('div');
  host.innerHTML = html;
  let max = 0;
  host.querySelectorAll('tr').forEach((row) => {
    max = Math.max(max, rowColumnCount(row));
  });
  return max;
}

/**
 * 시트 단 수. 글자 수가 임계를 넘고 넓은 표가 없을 때만 2단.
 *
 * @param textLength 태그를 뺀 본문 글자 수
 * @param tableColumns maxTableColumns 결과
 */
export function decideSheetColumns(textLength: number, tableColumns: number): 1 | 2 {
  if (textLength <= SINGLE_COL_CHAR_THRESHOLD) return 1;
  if (tableColumns >= WIDE_TABLE_MIN_COLUMNS) return 1;
  return 2;
}
