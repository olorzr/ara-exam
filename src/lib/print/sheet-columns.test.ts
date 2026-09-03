import { describe, expect, it } from 'vitest';
import { decideSheetColumns, rowColumnCount } from './sheet-columns';

function firstRow(html: string): Element {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host.querySelector('tr')!;
}

describe('rowColumnCount', () => {
  it('셀 수를 센다', () => {
    expect(rowColumnCount(firstRow('<table><tbody><tr><td>1</td><td>2</td><td>3</td></tr></tbody></table>'))).toBe(3);
  });

  it('colspan 을 합산한다', () => {
    expect(
      rowColumnCount(firstRow('<table><tbody><tr><td colspan="2">묶음</td><td>3</td></tr></tbody></table>')),
    ).toBe(3);
  });

  it('잘못된 colspan 은 1 로 센다', () => {
    expect(
      rowColumnCount(firstRow('<table><tbody><tr><td colspan="abc">1</td><td>2</td></tr></tbody></table>')),
    ).toBe(2);
  });
});

describe('decideSheetColumns', () => {
  it('글자 수가 임계 이하면 1단', () => {
    expect(decideSheetColumns(300)).toBe(1);
    expect(decideSheetColumns(0)).toBe(1);
  });

  it('글자 수가 임계를 넘으면 2단 — 표 열 수는 보지 않는다 (열 폭 맞춤이 칸에 맞춘다)', () => {
    expect(decideSheetColumns(301)).toBe(2);
    expect(decideSheetColumns(5000)).toBe(2);
  });
});
