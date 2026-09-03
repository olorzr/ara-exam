import { describe, expect, it } from 'vitest';
import {
  applyColumnWidths,
  colgroupFromWidths,
  fitColumnWidths,
  LONG_COL_MIN_PX,
  COLUMN_SLACK_PX,
} from './table-col-fit';

const total = (values: number[]) => values.reduce((sum, value) => sum + value, 0);

describe('fitColumnWidths', () => {
  it('다 들어가면 비례로 늘린다 (자동 레이아웃과 같다)', () => {
    expect(fitColumnWidths([98, 298], 800)).toEqual([200, 600]);
  });

  it('짧은 열은 실측보다 넓게 준다 — 딱 맞게 주면 마지막 글자가 접힌다', () => {
    // 실측 합(678)이 폭(680)과 거의 같은 표. 짧은 열이 실측 그대로면 인쇄에서 한 글자씩 접혔다
    const widths = fitColumnWidths([45, 45, 45, 543], 680)!;
    [0, 1, 2].forEach((index) => expect(widths[index]).toBeGreaterThan(45));
    expect(total(widths)).toBeCloseTo(680, 6);
  });

  it('여유까지 다 들어가면 비례로 늘리고 모든 열이 실측보다 넓다', () => {
    const raw = [45, 45, 45, 400];
    const widths = fitColumnWidths(raw, 680)!;
    widths.forEach((width, index) => expect(width).toBeGreaterThan(raw[index]));
    expect(total(widths)).toBeCloseTo(680, 6);
  });

  it('짧은 열은 max-content 그대로 보호하고 긴 열이 나머지를 받는다', () => {
    // 2~3글자 열 두 개 + 긴 글 열 하나, 폭 680
    const widths = fitColumnWidths([50, 111, 2000], 680)!;
    expect(widths[0]).toBe(50 + COLUMN_SLACK_PX);
    expect(widths[1]).toBe(111 + COLUMN_SLACK_PX);
    expect(widths[2]).toBeCloseTo(680 - 52 - 113, 6);
    expect(widths[2]).toBeGreaterThan(LONG_COL_MIN_PX);
    expect(total(widths)).toBeCloseTo(680, 6);
  });

  it('긴 열끼리는 max-content 비례로 나눠 줄 수를 고르게 한다', () => {
    const widths = fitColumnWidths([80, 400, 2000], 680)!;
    expect(widths[0]).toBe(80 + COLUMN_SLACK_PX);
    // 남은 폭을 402:2002 (여유 포함) 으로
    expect(widths[1] / widths[2]).toBeCloseTo(402 / 2002, 6);
    expect(total(widths)).toBeCloseTo(680, 6);
  });

  it('긴 열의 비례 몫이 하한 아래면 하한으로 고정한다', () => {
    const widths = fitColumnWidths([80, 308, 10000], 680)!;
    expect(widths[1]).toBe(LONG_COL_MIN_PX);
    expect(widths[2]).toBeCloseTo(680 - 82 - LONG_COL_MIN_PX, 6);
    expect(total(widths)).toBeCloseTo(680, 6);
  });

  it('보호 열이 폭을 다 먹으면 가장 넓은 보호 열부터 푼다', () => {
    // 80×8 = 640 보호 → 긴 열 몫 40 < 96 → 보호를 풀어 하한을 확보한다
    const maxWidths = [...Array.from({ length: 8 }, () => 80), 1000];
    const widths = fitColumnWidths(maxWidths, 680)!;
    expect(widths[8]).toBeGreaterThanOrEqual(LONG_COL_MIN_PX);
    expect(total(widths)).toBeCloseTo(680, 6);
    widths.forEach((width) => expect(width).toBeGreaterThan(0));
  });

  it('모든 열이 비슷하게 넓으면 균등에 가깝게 비례로 나눈다', () => {
    const widths = fitColumnWidths([150, 150, 150, 150, 150], 680)!;
    widths.forEach((width) => expect(width).toBeCloseTo(136, 6));
    expect(total(widths)).toBeCloseTo(680, 6);
  });

  it('열이 너무 많아 하한도 못 지키면 전부 비례', () => {
    const maxWidths = Array.from({ length: 10 }, () => 200);
    const widths = fitColumnWidths(maxWidths, 500)!;
    widths.forEach((width) => expect(width).toBeCloseTo(50, 6));
  });

  it('잘못된 입력은 null', () => {
    expect(fitColumnWidths([100], 500)).toBeNull();
    expect(fitColumnWidths([100, 0], 500)).toBeNull();
    expect(fitColumnWidths([100, 100], 0)).toBeNull();
    expect(fitColumnWidths([], 500)).toBeNull();
  });

  it('결과는 원래 열 순서다', () => {
    const widths = fitColumnWidths([2000, 50], 680)!;
    expect(widths[1]).toBe(50 + COLUMN_SLACK_PX);
    expect(widths[0]).toBeCloseTo(680 - 52, 6);
  });
});

describe('colgroupFromWidths', () => {
  it('퍼센트 col 을 만든다', () => {
    const colgroup = colgroupFromWidths([300, 100])!;
    const widths = Array.from(colgroup.querySelectorAll('col')).map((col) => (col as HTMLElement).style.width);
    expect(widths).toEqual(['75%', '25%']);
  });

  it('빈 입력·합 0 은 null', () => {
    expect(colgroupFromWidths([])).toBeNull();
    expect(colgroupFromWidths([0, 0])).toBeNull();
    expect(colgroupFromWidths(undefined)).toBeNull();
  });
});

describe('applyColumnWidths', () => {
  const table = '<table><tbody><tr><td>가</td><td>나</td></tr></tbody></table>';

  it('colgroup 과 fixed 레이아웃을 박는다', () => {
    const html = applyColumnWidths(table, [100, 300]);
    const host = document.createElement('div');
    host.innerHTML = html;
    const cols = Array.from(host.querySelectorAll('colgroup > col')).map((col) => (col as HTMLElement).style.width);
    expect(cols).toEqual(['25%', '75%']);
    expect(host.querySelector('table')?.style.tableLayout).toBe('fixed');
    expect(host.querySelector('table')?.firstElementChild?.tagName).toBe('COLGROUP');
  });

  it('기존 colgroup 은 갈아 끼운다', () => {
    const withColgroup = applyColumnWidths(table, [100, 100]);
    const host = document.createElement('div');
    host.innerHTML = applyColumnWidths(withColgroup, [300, 100]);
    expect(host.querySelectorAll('colgroup')).toHaveLength(1);
    expect((host.querySelector('col') as HTMLElement).style.width).toBe('75%');
  });

  it('루트가 표가 아니면 손대지 않는다', () => {
    const wrapped = `<blockquote>${table}</blockquote>`;
    expect(applyColumnWidths(wrapped, [100, 300])).toBe(wrapped);
  });
});
