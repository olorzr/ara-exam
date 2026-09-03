import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import A4Document from './A4Document';
import {
  A4_HEIGHT_PX,
  CAPACITY_SAFETY_PX,
  PAGE_PAD_BOTTOM,
  PAGE_PAD_TOP,
} from '@/lib/print/constants';
import type { SplitRequest } from '@/lib/print/paginate';

const FOOTER_H = 20;
const FIRST_HEADER_H = 60;
const LATER_HEADER_H = 30;
const BLOCK_H = 200;

/**
 * jsdom 은 레이아웃을 하지 않으므로 높이를 흉내 낸다.
 * 요소 자신이나 자손의 data-h 값을 높이로 돌려준다.
 */
beforeAll(() => {
  Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
    configurable: true,
    value(this: Element) {
      const own = (this as HTMLElement).dataset?.h;
      // 푸터는 컴포넌트가 직접 그리므로 data-h 를 심을 수 없다
      const footer = this.matches?.('[data-measure="footer"]') ? String(FOOTER_H) : undefined;
      const nested = this.querySelector<HTMLElement>('[data-h]')?.dataset.h;
      const height = Number(own ?? footer ?? nested ?? 0);
      return { height, width: 0, top: 0, left: 0, right: 0, bottom: height, x: 0, y: 0, toJSON: () => ({}) };
    },
  });

  // jsdom 에 ResizeObserver 가 없다
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

/** 실측 높이로부터 기대 페이지 수를 계산한다 (상수가 바뀌어도 테스트가 따라간다) */
function blocksPerPage(headerHeight: number): number {
  const body = A4_HEIGHT_PX - PAGE_PAD_TOP - PAGE_PAD_BOTTOM - FOOTER_H - headerHeight;
  return Math.floor((body - CAPACITY_SAFETY_PX) / BLOCK_H);
}

function renderDocument(blockCount: number) {
  const blocks = Array.from({ length: blockCount }, (_, i) => (
    <div key={i} data-h={BLOCK_H}>
      문항 {i + 1}
    </div>
  ));
  return render(
    <A4Document
      blocks={blocks}
      columns={1}
      firstPageHeader={<div data-h={FIRST_HEADER_H}>전체 헤더</div>}
      laterPageHeader={<div data-h={LATER_HEADER_H}>컴팩트 헤더</div>}
    />,
  );
}

/** 측정 컨테이너를 뺀 실제 낱장들 */
function sheets(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('.a4-stack .a4-sheet'));
}

describe('A4Document', () => {
  it('한 페이지에 들어가면 낱장 한 장만 그린다', () => {
    const { container } = renderDocument(2);
    expect(sheets(container)).toHaveLength(1);
  });

  it('넘치면 실측 용량대로 낱장을 늘린다', () => {
    const perFirst = blocksPerPage(FIRST_HEADER_H);
    const perLater = blocksPerPage(LATER_HEADER_H);
    const total = perFirst + perLater + 1;
    const { container } = renderDocument(total);
    expect(sheets(container)).toHaveLength(3);
  });

  it('모든 낱장에 푸터가 있고 페이지 번호가 이어진다', () => {
    const total = blocksPerPage(FIRST_HEADER_H) + blocksPerPage(LATER_HEADER_H) + 1;
    const { container } = renderDocument(total);
    const rendered = sheets(container);
    rendered.forEach((sheet, i) => {
      const footer = sheet.querySelector('.a4-footer');
      expect(footer).not.toBeNull();
      expect(footer?.querySelector('.a4-footer__page')?.textContent).toBe(`${i + 1} / ${rendered.length}`);
      // 푸터는 낱장의 마지막 요소 — 본문이 flex:1 이라 언제나 페이지 바닥이다
      expect(sheet.lastElementChild).toBe(footer);
    });
  });

  it('마지막 낱장에만 페이지 넘김을 끄는 클래스가 붙는다', () => {
    const total = blocksPerPage(FIRST_HEADER_H) + 1;
    const { container } = renderDocument(total);
    const rendered = sheets(container);
    expect(rendered).toHaveLength(2);
    expect(rendered[0].classList.contains('a4-sheet--last')).toBe(false);
    expect(rendered[1].classList.contains('a4-sheet--last')).toBe(true);
  });

  it('breakAfterLast 면 마지막 낱장 뒤에도 페이지를 넘긴다', () => {
    const { container } = render(
      <A4Document
        blocks={[<div key="a" data-h={BLOCK_H} />]}
        firstPageHeader={<div data-h={FIRST_HEADER_H}>헤더</div>}
        breakAfterLast
      />,
    );
    expect(sheets(container)[0].classList.contains('a4-sheet--last')).toBe(false);
  });

  it('1페이지는 전체 헤더, 2페이지부터는 컴팩트 헤더가 반복된다', () => {
    const total = blocksPerPage(FIRST_HEADER_H) + 1;
    const { container } = renderDocument(total);
    const rendered = sheets(container);
    expect(rendered[0].textContent).toContain('전체 헤더');
    expect(rendered[1].textContent).toContain('컴팩트 헤더');
    expect(rendered[1].textContent).not.toContain('전체 헤더');
  });

  it('블록이 유실되거나 중복되지 않는다', () => {
    const total = 17;
    const { container } = renderDocument(total);
    const texts = sheets(container).flatMap((sheet) =>
      Array.from(sheet.querySelectorAll('.a4-block')).map((b) => b.textContent),
    );
    expect(texts).toHaveLength(total);
    expect(texts).toEqual(Array.from({ length: total }, (_, i) => `문항 ${i + 1}`));
  });

  it('페이지보다 훨씬 큰 블록은 잘리지 않고 페이지에 맞게 축소된다', () => {
    const huge = 5000;
    const { container } = render(
      <A4Document
        blocks={[<div key="huge" data-h={huge}>아주 긴 지문</div>]}
        firstPageHeader={<div data-h={FIRST_HEADER_H}>헤더</div>}
      />,
    );
    const scaled = container.querySelector<HTMLElement>('.a4-stack .a4-block--scaled');
    expect(scaled).not.toBeNull();
    const scale = Number(scaled!.style.transform.match(/scale\(([\d.]+)\)/)![1]);
    const capacity = A4_HEIGHT_PX - PAGE_PAD_TOP - PAGE_PAD_BOTTOM - FOOTER_H - FIRST_HEADER_H;
    // 하한에 걸려 덜 줄어들면 넘친 부분이 인쇄에서 사라진다
    expect(scale * huge).toBeLessThanOrEqual(capacity + 1);
    expect(scaled!.textContent).toBe('아주 긴 지문');
  });

  it('쪼갤 수 있는 블록은 onSplitRequest 로 알려 준다 — 앞 조각은 남은 자리, 뒤는 2페이지 용량', () => {
    const calls: SplitRequest[][] = [];
    render(
      <A4Document
        blocks={[<div key="huge" data-h={5000}>긴 표</div>]}
        firstPageHeader={<div data-h={FIRST_HEADER_H}>헤더</div>}
        laterPageHeader={<div data-h={LATER_HEADER_H}>컴팩트</div>}
        splittable={[true]}
        onSplitRequest={(requests) => calls.push(requests)}
      />,
    );
    expect(calls.length).toBeGreaterThan(0);
    const first = A4_HEIGHT_PX - PAGE_PAD_TOP - PAGE_PAD_BOTTOM - FOOTER_H - FIRST_HEADER_H;
    const later = A4_HEIGHT_PX - PAGE_PAD_TOP - PAGE_PAD_BOTTOM - FOOTER_H - LATER_HEADER_H;
    expect(calls[0]).toEqual([
      { index: 0, firstCapacity: first - CAPACITY_SAFETY_PX, laterCapacity: later - CAPACITY_SAFETY_PX },
    ]);
  });

  it('앞 블록이 채운 뒤 남은 자리를 앞 조각 용량으로 알려 준다', () => {
    const calls: SplitRequest[][] = [];
    render(
      <A4Document
        blocks={[<div key="intro" data-h={BLOCK_H}>서문</div>, <div key="table" data-h={5000}>긴 표</div>]}
        firstPageHeader={<div data-h={FIRST_HEADER_H}>헤더</div>}
        laterPageHeader={<div data-h={LATER_HEADER_H}>컴팩트</div>}
        splittable={[false, true]}
        onSplitRequest={(requests) => calls.push(requests)}
      />,
    );
    const first = A4_HEIGHT_PX - PAGE_PAD_TOP - PAGE_PAD_BOTTOM - FOOTER_H - FIRST_HEADER_H;
    expect(calls[0][0].index).toBe(1);
    expect(calls[0][0].firstCapacity).toBe(first - CAPACITY_SAFETY_PX - BLOCK_H);
  });

  it('쪼갤 수 없는 블록은 분할을 요청하지 않는다', () => {
    const calls: SplitRequest[][] = [];
    render(
      <A4Document
        blocks={[<div key="huge" data-h={5000}>긴 지문</div>]}
        firstPageHeader={<div data-h={FIRST_HEADER_H}>헤더</div>}
        onSplitRequest={(requests) => calls.push(requests)}
      />,
    );
    expect(calls).toHaveLength(0);
  });

  it('블록이 없어도 헤더·푸터가 있는 낱장 한 장은 나온다', () => {
    render(
      <A4Document blocks={[]} firstPageHeader={<div data-h={FIRST_HEADER_H}>빈 시험지</div>} />,
    );
    expect(screen.getAllByText('빈 시험지').length).toBeGreaterThan(0);
  });
});
