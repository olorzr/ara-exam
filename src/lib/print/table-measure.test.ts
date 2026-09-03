import { beforeAll, describe, expect, it } from 'vitest';
import { measureMaxContentWidths } from './table-measure';

/** jsdom 은 레이아웃을 하지 않으므로 셀 폭을 data-w 로 흉내 낸다 */
beforeAll(() => {
  Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
    configurable: true,
    value(this: Element) {
      const width = Number((this as HTMLElement).dataset?.w ?? 0);
      return { width, height: 0, top: 0, left: 0, right: width, bottom: 0, x: 0, y: 0, toJSON: () => ({}) };
    },
  });
});

function withRoot<T>(run: (root: HTMLElement) => T): T {
  const root = document.createElement('div');
  document.body.appendChild(root);
  try {
    return run(root);
  } finally {
    root.remove();
  }
}

describe('measureMaxContentWidths', () => {
  it('열마다 colspan 1 인 셀의 폭을 돌려준다', () => {
    const html =
      '<table><tbody><tr><td data-w="40">가</td><td data-w="300">긴 글</td></tr></tbody></table>';
    expect(withRoot((root) => measureMaxContentWidths(html, root, 'sheet-body'))).toEqual([40, 300]);
  });

  it('병합 셀은 건너뛰고 다른 행에서 그 열의 폭을 찾는다', () => {
    const html =
      '<table><tbody>' +
      '<tr><td colspan="2" data-w="500">묶음</td><td data-w="60">끝</td></tr>' +
      '<tr><td data-w="40">가</td><td data-w="90">나</td><td data-w="60">다</td></tr>' +
      '</tbody></table>';
    expect(withRoot((root) => measureMaxContentWidths(html, root, 'sheet-body'))).toEqual([40, 90, 60]);
  });

  it('rowspan 으로 밀린 열도 제자리에 넣는다', () => {
    const html =
      '<table><tbody>' +
      '<tr><td rowspan="2" data-w="40">구분</td><td data-w="200">가</td></tr>' +
      '<tr><td data-w="180">나</td></tr>' +
      '</tbody></table>';
    expect(withRoot((root) => measureMaxContentWidths(html, root, 'sheet-body'))).toEqual([40, 200]);
  });

  it('폭을 못 잰 열이 있으면 null (jsdom·레이아웃 전)', () => {
    const html = '<table><tbody><tr><td data-w="40">가</td><td>나</td></tr></tbody></table>';
    expect(withRoot((root) => measureMaxContentWidths(html, root, 'sheet-body'))).toBeNull();
  });

  it('colspan 셀뿐인 열은 잴 수 없어 null', () => {
    const html = '<table><tbody><tr><td colspan="2" data-w="500">묶음</td></tr></tbody></table>';
    expect(withRoot((root) => measureMaxContentWidths(html, root, 'sheet-body'))).toBeNull();
  });

  it('루트가 표가 아니면 null', () => {
    const html = '<p data-w="100">본문</p>';
    expect(withRoot((root) => measureMaxContentWidths(html, root, 'sheet-body'))).toBeNull();
  });

  it('측정이 끝나면 프로브를 남기지 않는다', () => {
    const html = '<table><tbody><tr><td data-w="40">가</td><td data-w="300">나</td></tr></tbody></table>';
    withRoot((root) => {
      measureMaxContentWidths(html, root, 'sheet-body');
      expect(root.children).toHaveLength(0);
    });
  });

  it('프로브는 시트 본문 클래스와 max-content 폭을 쓴다 (접힌 폭을 재지 않도록)', () => {
    const html = '<table style="table-layout: fixed"><colgroup><col style="width: 50%"></colgroup>' +
      '<tbody><tr><td data-w="40">가</td><td data-w="300">나</td></tr></tbody></table>';
    withRoot((root) => {
      const seen: Array<{ className: string; width: string; tableWidth: string; cols: number }> = [];
      const original = root.appendChild.bind(root);
      root.appendChild = ((node: Node) => {
        const el = original(node) as HTMLElement;
        const table = el.querySelector('table');
        seen.push({
          className: el.className,
          width: el.style.width,
          tableWidth: table?.style.width ?? '',
          cols: el.querySelectorAll('colgroup').length,
        });
        return el;
      }) as typeof root.appendChild;
      measureMaxContentWidths(html, root, 'sheet-body');
      expect(seen).toEqual([{ className: 'sheet-body', width: 'max-content', tableWidth: 'auto', cols: 0 }]);
    });
  });
});
