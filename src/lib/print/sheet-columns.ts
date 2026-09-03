/**
 * 개념지 시트의 단(컬럼) 수 결정.
 *
 * 글자 수가 많으면 2단으로 읽기 좋게 한다. 표 열 수는 보지 않는다 —
 * 2026-09-03 에 "열 3개 이상 표가 있으면 1단" 규칙을 뒀던 건 열 폭을 못 맞춰 넓은 표가 2단 칸(≈328px)에서
 * 깨지던 시절의 임시 조치였다. 이제 열 폭 맞춤(table-col-fit)이 칸 폭에 맞춰 주고, 1단은 페이지 수만 늘린다.
 */

import { parseColSpan } from './table-dom';

/** 1단 최대 글자 수 — 초과 시 2단 레이아웃 */
export const SINGLE_COL_CHAR_THRESHOLD = 300;

/** 한 행이 차지하는 열 수 (직계 td/th 의 colspan 합). 잘못된 colspan 은 1 로 센다 */
export function rowColumnCount(row: Element): number {
  return Array.from(row.children).reduce((sum, cell) => {
    if (cell.tagName !== 'TD' && cell.tagName !== 'TH') return sum;
    return sum + parseColSpan(cell);
  }, 0);
}

/**
 * 시트 단 수. 글자 수가 임계를 넘으면 2단.
 *
 * @param textLength 태그를 뺀 본문 글자 수
 */
export function decideSheetColumns(textLength: number): 1 | 2 {
  return textLength > SINGLE_COL_CHAR_THRESHOLD ? 2 : 1;
}
