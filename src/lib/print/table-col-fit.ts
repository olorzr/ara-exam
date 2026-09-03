/**
 * 표 열 폭 자동 맞춤.
 *
 * 셀에 `overflow-wrap: anywhere` 를 주면(표가 시트 폭을 뚫지 않게 하는 안전망) 셀의 min-content 가
 * 한 글자로 무너져, 자동 표 레이아웃이 긴 글 열에 폭을 몰아주고 2~3글자 열엔 거의 안 준다 —
 * 짧은 열이 세로로 길게 늘어난다. CSS 만으로는 "짧은 열은 통째로, 긴 열만 접기"를 표현할 수 없어
 * 열마다 max-content 폭을 재고(호출부) 여기서 폭을 나눠 `<colgroup>` + `table-layout: fixed` 로 박는다.
 */

import { createHost, rootTable } from './table-dom';

/** 긴 글 열이 이보다 좁아지면 한 줄에 대여섯 글자도 못 들어간다 — 비례 배분의 하한 */
export const LONG_COL_MIN_PX = 96;

/**
 * 열마다 실측 폭에 얹는 여유.
 * 폭을 max-content 에 **딱 맞게** 주면 접힌다 — 퍼센트 환산·테두리 겹침(border-collapse)에서
 * 1픽셀 미만이 깎여도 마지막 글자가 다음 줄로 넘어간다. 실측으로 확인한 회귀다.
 */
export const COLUMN_SLACK_PX = 2;

/** 맞춤 대상 최소 열 수 — 1열 표는 나눌 게 없다 */
const MIN_FIT_COLUMNS = 2;

/** 조각·맞춤 colgroup 의 퍼센트 소수 자릿수 */
const COL_WIDTH_DECIMALS = 3;

const sum = (values: readonly number[]) => values.reduce((acc, value) => acc + value, 0);

const proportional = (maxWidths: readonly number[], available: number): number[] => {
  const total = sum(maxWidths);
  return maxWidths.map((width) => (width * available) / total);
};

/**
 * 오름차순 정렬 순서에서 앞에서부터 몇 열을 보호할지 센다.
 * k 번째 열은 그 폭이 '남은 열들의 균등 상한'(남은 폭 / 남은 열 수) 이하일 때만 보호한다 —
 * 보호 비용이 제 몫 이하라 다른 열이 손해 보지 않는다.
 */
function countProtected(widths: readonly number[], order: readonly number[], available: number): number {
  let used = 0;
  let count = 0;
  for (let k = 0; k < order.length; k++) {
    const width = widths[order[k]];
    const cap = (available - used) / (order.length - k);
    if (width > cap) break;
    used += width;
    count++;
  }
  return count;
}

/**
 * 긴 열들에 남은 폭을 max-content 비례로 나눈다 — 줄 수가 고르게 되어 행 높이가 가장 낮다.
 * 비례 몫이 하한(min(max-content, LONG_COL_MIN_PX)) 아래인 열은 하한으로 고정하고 나머지를 다시 나눈다.
 * 호출부가 free ≥ (열 수 × LONG_COL_MIN_PX) 를 보장하므로 반복은 끝나고 합은 free 와 같다.
 */
function distributeLong(maxWidths: readonly number[], pool: readonly number[], free: number): Map<number, number> {
  const result = new Map<number, number>();
  let remaining = [...pool];
  let freeLeft = free;
  for (let pass = 0; pass < pool.length && remaining.length > 0; pass++) {
    const poolTotal = sum(remaining.map((index) => maxWidths[index]));
    const clamped = remaining.filter(
      (index) => (maxWidths[index] * freeLeft) / poolTotal < Math.min(maxWidths[index], LONG_COL_MIN_PX),
    );
    if (clamped.length === 0) break;
    clamped.forEach((index) => {
      const floor = Math.min(maxWidths[index], LONG_COL_MIN_PX);
      result.set(index, floor);
      freeLeft -= floor;
    });
    remaining = remaining.filter((index) => !result.has(index));
  }
  const poolTotal = sum(remaining.map((index) => maxWidths[index]));
  remaining.forEach((index) => result.set(index, (maxWidths[index] * freeLeft) / poolTotal));
  return result;
}

/**
 * 열별 max-content 폭을 `available` 안에 나눠 담는다.
 *
 * - 다 들어가면 비례로 늘린다(자동 레이아웃과 같다).
 * - 안 들어가면 **짧은 열부터 보호**(max-content 그대로 + 여유)하고, 긴 열들이 남은 폭을 비례로 나눈다.
 *   긴 열마다 LONG_COL_MIN_PX 는 남겨야 하므로 안 되면 가장 넓은 보호 열부터 풀고, 그래도 안 되면 전부 비례.
 *
 * @returns 원래 열 순서의 px 폭(합 = available). 열이 2개 미만이거나 값이 이상하면 null
 */
export function fitColumnWidths(rawWidths: readonly number[], available: number): number[] | null {
  const count = rawWidths.length;
  if (count < MIN_FIT_COLUMNS || !(available > 0) || rawWidths.some((width) => !(width > 0))) return null;

  // 실측 폭에 여유를 얹은 값을 기준으로 나눈다 — 딱 맞게 주면 마지막 글자가 접힌다
  const maxWidths = rawWidths.map((width) => width + COLUMN_SLACK_PX);
  if (sum(maxWidths) <= available) return proportional(maxWidths, available);

  const order = maxWidths.map((_, index) => index).sort((a, b) => maxWidths[a] - maxWidths[b]);
  let protectedCount = Math.min(countProtected(maxWidths, order, available), count - 1);
  const freeWith = (protectedN: number) =>
    available - sum(order.slice(0, protectedN).map((index) => maxWidths[index]));
  while (protectedCount > 0 && freeWith(protectedCount) < (count - protectedCount) * LONG_COL_MIN_PX) {
    protectedCount--;
  }
  if (protectedCount === 0 && available < count * LONG_COL_MIN_PX) return proportional(maxWidths, available);

  const widths = new Array<number>(count);
  order.slice(0, protectedCount).forEach((index) => {
    widths[index] = maxWidths[index];
  });
  distributeLong(maxWidths, order.slice(protectedCount), freeWith(protectedCount)).forEach((width, index) => {
    widths[index] = width;
  });
  return widths;
}

/**
 * px 폭 배열을 퍼센트 `<colgroup>` 으로 만든다.
 * 조각 표는 각자 독립된 표라 auto 레이아웃이면 페이지마다 열 폭이 흔들리므로 같은 비율로 고정한다.
 */
export function colgroupFromWidths(colWidths?: readonly number[]): HTMLElement | null {
  if (!colWidths || colWidths.length === 0) return null;
  const total = sum(colWidths);
  if (total <= 0) return null;
  const colgroup = document.createElement('colgroup');
  colWidths.forEach((width) => {
    const col = document.createElement('col');
    col.style.width = `${((width / total) * 100).toFixed(COL_WIDTH_DECIMALS)}%`;
    colgroup.appendChild(col);
  });
  return colgroup;
}

/**
 * 표 HTML 에 열 폭을 박는다 — 기존 colgroup 을 지우고 퍼센트 colgroup + `table-layout: fixed`.
 * 블록 루트가 표가 아니면 입력을 그대로 돌려준다.
 */
export function applyColumnWidths(tableHtml: string, widths: readonly number[]): string {
  const host = createHost(tableHtml);
  const table = host ? rootTable(host) : null;
  const colgroup = table ? colgroupFromWidths(widths) : null;
  if (!table || !colgroup) return tableHtml;
  table.querySelectorAll('colgroup').forEach((el) => el.remove());
  table.insertBefore(colgroup, table.firstChild);
  table.style.tableLayout = 'fixed';
  return table.outerHTML;
}
