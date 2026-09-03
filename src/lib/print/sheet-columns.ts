/**
 * 개념지 시트의 단(컬럼) 수 결정.
 *
 * 글자 수가 많으면 2단으로 읽기 좋게 한다. 블록 루트인 표는 열 폭 맞춤(table-col-fit)이 2단 칸(≈328px)에
 * 맞춰 주므로 열 수를 보지 않는다 — 2026-09-03 의 "열 3개 이상이면 1단" 은 열 폭을 못 맞추던 시절의
 * 임시 조치였고 1단은 페이지 수만 늘린다. 다만 **래퍼 안의 표**(blockquote/li 속)는 맞춤도 분할도
 * 못 하므로(`rootTable` 가드) 그런 넓은 표가 있을 때만 1단으로 되돌린다.
 */

import { createHost, parseColSpan } from './table-dom';

/** 1단 최대 글자 수 — 초과 시 2단 레이아웃 */
export const SINGLE_COL_CHAR_THRESHOLD = 300;

/** 맞출 수 없는(래퍼 안의) 표가 이 열 수 이상이면 2단을 포기하고 1단으로 그린다 */
export const WIDE_TABLE_MIN_COLUMNS = 3;

/** 한 행이 차지하는 열 수 (직계 td/th 의 colspan 합). 잘못된 colspan 은 1 로 센다 */
export function rowColumnCount(row: Element): number {
  return Array.from(row.children).reduce((sum, cell) => {
    if (cell.tagName !== 'TD' && cell.tagName !== 'TH') return sum;
    return sum + parseColSpan(cell);
  }, 0);
}

/**
 * 열 폭 맞춤이 손대지 못하는 표 — 블록 루트가 아니라 래퍼(blockquote/li) 안에 든 표 — 중 가장 넓은 열 수.
 * 루트 표는 세지 않는다(맞춤이 2단 칸에 맞춘다). 표가 없거나 DOM 이 없으면(SSR) 0.
 */
export function maxWrappedTableColumns(html: string): number {
  const host = createHost(html);
  if (!host) return 0;
  let max = 0;
  Array.from(host.children).forEach((block) => {
    if (block instanceof HTMLTableElement) return;
    block.querySelectorAll('tr').forEach((row) => {
      max = Math.max(max, rowColumnCount(row));
    });
  });
  return max;
}

/**
 * 시트 단 수. 글자 수가 임계를 넘으면 2단 — 단, 맞출 수 없는 넓은 표가 있으면 1단.
 *
 * @param textLength 태그를 뺀 본문 글자 수
 * @param wrappedTableColumns maxWrappedTableColumns 결과
 */
export function decideSheetColumns(textLength: number, wrappedTableColumns = 0): 1 | 2 {
  if (textLength <= SINGLE_COL_CHAR_THRESHOLD) return 1;
  if (wrappedTableColumns >= WIDE_TABLE_MIN_COLUMNS) return 1;
  return 2;
}
