import { describe, expect, it } from 'vitest';
import { decideSheetColumns, maxTableColumns } from './sheet-columns';

describe('maxTableColumns', () => {
  it('표가 없으면 0', () => {
    expect(maxTableColumns('<p>본문</p>')).toBe(0);
  });

  it('열 수를 센다', () => {
    expect(maxTableColumns('<table><tbody><tr><td>1</td><td>2</td><td>3</td></tr></tbody></table>')).toBe(3);
  });

  it('colspan 을 합산한다', () => {
    expect(
      maxTableColumns('<table><tbody><tr><td colspan="2">묶음</td><td>3</td></tr></tbody></table>'),
    ).toBe(3);
  });

  it('병합으로 셀 수가 적은 뒷행이 있어도 최댓값을 쓴다', () => {
    const html =
      '<table><tbody>' +
      '<tr><td rowspan="2">가</td><td>나</td><td>다</td></tr>' +
      '<tr><td>라</td><td>마</td></tr>' +
      '</tbody></table>';
    expect(maxTableColumns(html)).toBe(3);
  });

  it('표가 여럿이면 가장 넓은 표를 따른다', () => {
    const html =
      '<table><tbody><tr><td>1</td><td>2</td></tr></tbody></table>' +
      '<table><tbody><tr><td>1</td><td>2</td><td>3</td><td>4</td></tr></tbody></table>';
    expect(maxTableColumns(html)).toBe(4);
  });

  it('blockquote 안의 표도 센다', () => {
    expect(
      maxTableColumns('<blockquote><table><tbody><tr><td>1</td><td>2</td><td>3</td></tr></tbody></table></blockquote>'),
    ).toBe(3);
  });

  it('잘못된 colspan 은 1 로 센다', () => {
    expect(maxTableColumns('<table><tbody><tr><td colspan="abc">1</td><td>2</td></tr></tbody></table>')).toBe(2);
  });
});

describe('decideSheetColumns', () => {
  it('글자 수가 임계 이하면 1단', () => {
    expect(decideSheetColumns(300, 2)).toBe(1);
  });

  it('글자 수가 많고 좁은 표만 있으면 2단', () => {
    expect(decideSheetColumns(301, 2)).toBe(2);
    expect(decideSheetColumns(301, 0)).toBe(2);
  });

  it('열 3개 이상인 표가 있으면 1단으로 되돌린다', () => {
    expect(decideSheetColumns(301, 3)).toBe(1);
    expect(decideSheetColumns(5000, 5)).toBe(1);
  });
});
