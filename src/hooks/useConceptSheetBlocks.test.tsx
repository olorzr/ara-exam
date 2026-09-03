import { beforeAll, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { A4Document } from '@/components/print';
import { SHEET_BODY_CLASS, useConceptSheetBlocks } from './useConceptSheetBlocks';

const FOOTER_H = 20;
const HEADER_H = 60;
const ROW_H = 100;

/**
 * jsdom 은 레이아웃을 하지 않으므로 높이를 흉내 낸다.
 * 표는 자식 행 높이의 합, 그 외에는 자신 또는 첫 자손의 data-h.
 */
beforeAll(() => {
  Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
    configurable: true,
    value(this: Element) {
      const rows = this.querySelectorAll<HTMLElement>('tr[data-h]');
      const own = (this as HTMLElement).dataset?.h;
      const footer = this.matches?.('[data-measure="footer"]') ? String(FOOTER_H) : undefined;
      const height = rows.length
        ? Array.from(rows).reduce((sum, row) => sum + Number(row.dataset.h ?? 0), 0)
        : Number(own ?? footer ?? this.querySelector<HTMLElement>('[data-h]')?.dataset.h ?? 0);
      return { height, width: 0, top: 0, left: 0, right: 0, bottom: height, x: 0, y: 0, toJSON: () => ({}) };
    },
  });

  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

/** 개념지 렌더러와 같은 구조 — 훅이 만든 블록을 A4Document 에 넘긴다 */
function Sheet({ html }: { html: string }) {
  const { blocks, splittable, handleBeforePaginate, handleSplitRequest } = useConceptSheetBlocks(html);
  return (
    <A4Document
      blocks={blocks.map((chunk, i) => (
        <div key={i} className={SHEET_BODY_CLASS} dangerouslySetInnerHTML={{ __html: chunk }} />
      ))}
      columns={1}
      splittable={splittable}
      onBeforePaginate={handleBeforePaginate}
      onSplitRequest={handleSplitRequest}
      firstPageHeader={<div data-h={HEADER_H}>헤더</div>}
      laterPageHeader={<div data-h={HEADER_H}>컴팩트</div>}
    />
  );
}

function longTable(rowCount: number): string {
  const body = Array.from({ length: rowCount }, (_, i) => `<tr data-h="${ROW_H}"><td>단어${i}</td><td>뜻${i}</td></tr>`).join('');
  return `<table><tbody><tr data-h="${ROW_H}"><th>단어</th><th>뜻</th></tr>${body}</tbody></table>`;
}

function sheets(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('.a4-stack .a4-sheet'));
}

describe('useConceptSheetBlocks', () => {
  it('한 장에 안 들어가는 긴 표를 다음 장으로 이어붙인다', () => {
    const { container } = render(<Sheet html={longTable(30)} />);
    const rendered = sheets(container);
    expect(rendered.length).toBeGreaterThan(1);
    // 모든 낱장의 표 첫 행이 제목 행이다
    rendered.forEach((sheet) => {
      const headerCells = Array.from(sheet.querySelectorAll('tr')[0]?.children ?? []).map(
        (cell) => cell.textContent,
      );
      expect(headerCells).toEqual(['단어', '뜻']);
    });
    // 본문 행이 유실되지 않는다
    const bodyCells = rendered.flatMap((sheet) =>
      Array.from(sheet.querySelectorAll('td')).map((cell) => cell.textContent),
    );
    expect(bodyCells.filter((text) => text?.startsWith('단어'))).toHaveLength(30);
  });

  it('앞 블록이 남긴 자리를 표로 채우고 나머지를 다음 장으로 넘긴다', () => {
    const intro = `<p data-h="300">서문</p>`;
    const { container } = render(<Sheet html={`${intro}${longTable(30)}`} />);
    const rendered = sheets(container);
    expect(rendered.length).toBeGreaterThan(1);

    // 1페이지에 서문과 표가 함께 있고, 표 본문이 고아 한 줄이 아니다
    const firstPage = rendered[0];
    expect(firstPage.textContent).toContain('서문');
    const firstPageRows = Array.from(firstPage.querySelectorAll('td')).filter((cell) =>
      cell.textContent?.startsWith('단어'),
    );
    expect(firstPageRows.length).toBeGreaterThanOrEqual(2);

    // 본문 행이 유실되거나 중복되지 않는다
    const allRows = rendered.flatMap((sheet) =>
      Array.from(sheet.querySelectorAll('td'))
        .map((cell) => cell.textContent)
        .filter((text) => text?.startsWith('단어')),
    );
    expect(allRows).toHaveLength(30);
    expect(new Set(allRows).size).toBe(30);
    // 모든 낱장의 표는 제목 행으로 시작한다
    rendered.slice(1).forEach((sheet) => {
      const headerCells = Array.from(sheet.querySelectorAll('tr')[0]?.children ?? []).map((c) => c.textContent);
      expect(headerCells).toEqual(['단어', '뜻']);
    });
  });

  it('쪼갤 수 없는 병합 묶음은 축소해서 담고 렌더가 끝난다', () => {
    const unbreakable =
      '<table><tbody>' +
      Array.from({ length: 20 }, (_, i) =>
        i === 0
          ? `<tr data-h="${ROW_H}"><td rowspan="20">묶음</td><td>가${i}</td></tr>`
          : `<tr data-h="${ROW_H}"><td>가${i}</td></tr>`,
      ).join('') +
      '</tbody></table>';
    const { container } = render(<Sheet html={unbreakable} />);
    expect(container.querySelector('.a4-stack .a4-block--scaled')).not.toBeNull();
  });
});
