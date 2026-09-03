import { describe, expect, it } from 'vitest';
import { decideSheetColumns, maxWrappedTableColumns, rowColumnCount } from './sheet-columns';

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

describe('maxWrappedTableColumns', () => {
  const wide = '<table><tbody><tr><td>1</td><td>2</td><td>3</td></tr></tbody></table>';

  it('블록 루트인 표는 세지 않는다 (열 폭 맞춤이 맞춘다)', () => {
    expect(maxWrappedTableColumns(wide)).toBe(0);
    expect(maxWrappedTableColumns(`<p>본문</p>${wide}`)).toBe(0);
  });

  it('blockquote·li 안의 표는 센다 (맞춤도 분할도 못 한다)', () => {
    expect(maxWrappedTableColumns(`<blockquote>${wide}</blockquote>`)).toBe(3);
    expect(maxWrappedTableColumns(`<ul><li>${wide}</li></ul>`)).toBe(3);
  });

  it('colspan 을 합산하고 가장 넓은 래핑 표를 따른다', () => {
    const html =
      '<blockquote><table><tbody><tr><td colspan="2">묶음</td><td>3</td><td>4</td></tr></tbody></table></blockquote>' +
      `<div>${wide}</div>`;
    expect(maxWrappedTableColumns(html)).toBe(4);
  });

  it('표가 없으면 0', () => {
    expect(maxWrappedTableColumns('<p>본문</p>')).toBe(0);
  });
});

describe('decideSheetColumns', () => {
  it('글자 수가 임계 이하면 1단', () => {
    expect(decideSheetColumns(300)).toBe(1);
    expect(decideSheetColumns(0, 5)).toBe(1);
  });

  it('글자 수가 임계를 넘으면 2단 — 루트 표의 열 수는 보지 않는다', () => {
    expect(decideSheetColumns(301)).toBe(2);
    expect(decideSheetColumns(5000, 0)).toBe(2);
    expect(decideSheetColumns(301, 2)).toBe(2);
  });

  it('맞출 수 없는 넓은 표(래퍼 안)가 있으면 1단으로 되돌린다', () => {
    expect(decideSheetColumns(301, 3)).toBe(1);
    expect(decideSheetColumns(5000, 5)).toBe(1);
  });
});
