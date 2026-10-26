import { beforeAll, describe, expect, it, vi } from 'vitest';
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

  describe('표지·중철', () => {
    const bodySheets = (container: HTMLElement) =>
      Array.from(container.querySelectorAll<HTMLElement>('.a4-stack .a4-sheet:not(.a4-sheet--cover)'));

    it('표지는 맨 앞 한 장이고 쪽 번호를 세지 않는다', () => {
      const total = blocksPerPage(FIRST_HEADER_H) + 1;
      const { container } = render(
        <A4Document
          blocks={Array.from({ length: total }, (_, i) => <div key={i} data-h={BLOCK_H}>문항 {i + 1}</div>)}
          firstPageHeader={<div data-h={FIRST_HEADER_H}>전체 헤더</div>}
          laterPageHeader={<div data-h={LATER_HEADER_H}>컴팩트 헤더</div>}
          coverPage={<div>표지 내용</div>}
        />,
      );
      const first = container.querySelector('.a4-stack')!.firstElementChild!;
      expect(first.classList.contains('a4-sheet--cover')).toBe(true);
      expect(first.textContent).toBe('표지 내용');
      expect(first.querySelector('.a4-footer')).toBeNull();
      const body = bodySheets(container);
      expect(body).toHaveLength(2);
      expect(body.map((s) => s.querySelector('.a4-footer__page')?.textContent)).toEqual(['1 / 2', '2 / 2']);
    });

    it('중철 — 3쪽은 한 장 두 면, 블록이 유실되지 않고 빈 면이 하나', () => {
      const total = blocksPerPage(FIRST_HEADER_H) + blocksPerPage(LATER_HEADER_H) + 1;
      const { container } = render(
        <A4Document
          booklet
          blocks={Array.from({ length: total }, (_, i) => <div key={i} data-h={BLOCK_H}>문항 {i + 1}</div>)}
          firstPageHeader={<div data-h={FIRST_HEADER_H}>전체 헤더</div>}
          laterPageHeader={<div data-h={LATER_HEADER_H}>컴팩트 헤더</div>}
        />,
      );
      expect(container.querySelectorAll('.a4-stack .booklet-side')).toHaveLength(2);
      expect(container.querySelectorAll('.a4-stack .booklet-blank')).toHaveLength(1);
      const sheetsInStack = bodySheets(container);
      expect(sheetsInStack).toHaveLength(3);
      const pagesSeen = sheetsInStack.map((s) => s.querySelector('.a4-footer__page')?.textContent).sort();
      expect(pagesSeen).toEqual(['1 / 3', '2 / 3', '3 / 3']);
      const blocksSeen = container.querySelectorAll('.a4-stack .a4-block');
      expect(blocksSeen).toHaveLength(total);
    });

    it('뒷표지 — 본문 뒤 한 장이고 쪽 번호를 세지 않으며, 문서의 마지막 낱장 표시는 뒷표지로 옮겨 간다', () => {
      const total = blocksPerPage(FIRST_HEADER_H) + 1;
      const { container } = render(
        <A4Document
          blocks={Array.from({ length: total }, (_, i) => <div key={i} data-h={BLOCK_H}>문항 {i + 1}</div>)}
          firstPageHeader={<div data-h={FIRST_HEADER_H}>전체 헤더</div>}
          laterPageHeader={<div data-h={LATER_HEADER_H}>컴팩트 헤더</div>}
          coverPage={<div>표지 내용</div>}
          backCoverPage={<div>뒷표지 내용</div>}
        />,
      );
      const stack = container.querySelector('.a4-stack')!;
      const last = stack.lastElementChild!;
      expect(last.classList.contains('a4-sheet--cover-back')).toBe(true);
      expect(last.classList.contains('a4-sheet--last')).toBe(true);
      expect(last.getAttribute('aria-label')).toBe('뒷표지');
      expect(last.textContent).toBe('뒷표지 내용');
      const body = bodySheets(container);
      expect(body.map((s) => s.querySelector('.a4-footer__page')?.textContent)).toEqual(['1 / 2', '2 / 2']);
      expect(body.some((s) => s.classList.contains('a4-sheet--last'))).toBe(false);
    });

    it('중철 + 앞·뒷표지 — 뒷표지는 1장 앞면 왼쪽(책의 맨 뒤), 빈 면은 본문 끝과 뒷표지 사이', () => {
      const total = blocksPerPage(FIRST_HEADER_H) + blocksPerPage(LATER_HEADER_H) + 1;
      const { container } = render(
        <A4Document
          booklet
          coverPage={<div>표지 내용</div>}
          backCoverPage={<div>뒷표지 내용</div>}
          blocks={Array.from({ length: total }, (_, i) => <div key={i} data-h={BLOCK_H}>문항 {i + 1}</div>)}
          firstPageHeader={<div data-h={FIRST_HEADER_H}>전체 헤더</div>}
          laterPageHeader={<div data-h={LATER_HEADER_H}>컴팩트 헤더</div>}
        />,
      );
      // 앞표지 + 본문 3 + 뒷표지 = 5쪽 → 2장, 빈 면 셋
      const sides = Array.from(container.querySelectorAll('.a4-stack .booklet-side'));
      expect(sides).toHaveLength(4);
      expect(sides[0].querySelector('[data-slot="right"] .a4-sheet--cover:not(.a4-sheet--cover-back)')).not.toBeNull();
      expect(sides[0].querySelector('[data-slot="left"] .a4-sheet--cover-back')).not.toBeNull();
      expect(container.querySelectorAll('.a4-stack .booklet-blank')).toHaveLength(3);
      expect(sides[3].querySelector('[data-slot="left"] .a4-footer__page')?.textContent).toBe('3 / 3');
    });

    it('중철 + 표지 — 표지가 1쪽이 되어 1장 앞면 오른쪽에 온다', () => {
      const total = blocksPerPage(FIRST_HEADER_H) + blocksPerPage(LATER_HEADER_H) + 1;
      const { container } = render(
        <A4Document
          booklet
          coverPage={<div>표지 내용</div>}
          blocks={Array.from({ length: total }, (_, i) => <div key={i} data-h={BLOCK_H}>문항 {i + 1}</div>)}
          firstPageHeader={<div data-h={FIRST_HEADER_H}>전체 헤더</div>}
          laterPageHeader={<div data-h={LATER_HEADER_H}>컴팩트 헤더</div>}
        />,
      );
      const first = container.querySelector('.a4-stack .booklet-side')!;
      expect(first.querySelector('[data-slot="right"] .a4-sheet--cover')).not.toBeNull();
      expect(first.querySelector('[data-slot="left"] .a4-footer__page')?.textContent).toBe('3 / 3');
      expect(container.querySelectorAll('.a4-stack .booklet-blank')).toHaveLength(0);
    });
  });

  describe('강제 쪽 넘김 · 빈 쪽 · 쪽 수 알림(책)', () => {
    const chapterDoc = (props: { padPagesTo?: number; onLayout?: (info: { pageCount: number }) => void }) => (
      <A4Document
        blocks={[<div key="a" data-h={BLOCK_H}>1장</div>, <div key="b" data-h={BLOCK_H}>2장</div>]}
        breakBefore={BREAKS}
        firstPageHeader={<div data-h={FIRST_HEADER_H}>머리</div>}
        laterPageHeader={<div data-h={LATER_HEADER_H}>머리</div>}
        {...props}
      />
    );
    /** 참조가 안정적이어야 한다 — 매 렌더 새 배열이면 measure 가 바뀐다 */
    const BREAKS = [false, 'odd'] as const;

    it("'odd' 로 끼운 빈 쪽은 머리글·푸터·블록이 없고 쪽 수(N)에는 센다", () => {
      const { container } = render(chapterDoc({}));
      const rendered = sheets(container);
      expect(rendered).toHaveLength(3);
      const blank = rendered[1];
      expect(blank.classList.contains('a4-sheet--blank')).toBe(true);
      expect(blank.querySelector('.a4-footer')).toBeNull();
      expect(blank.querySelector('.a4-block')).toBeNull();
      expect(blank.getAttribute('aria-label')).toBe('2쪽 (빈 쪽)');
      expect(rendered[2].textContent).toContain('2장');
      expect(rendered[2].querySelector('.a4-footer__page')?.textContent).toBe('3 / 3');
    });

    it('padPagesTo — 낱장 수가 배수가 되고 마지막(빈) 낱장에만 페이지 넘김을 끈다', () => {
      const { container } = render(chapterDoc({ padPagesTo: 4 }));
      const rendered = sheets(container);
      expect(rendered).toHaveLength(4);
      expect(rendered[3].classList.contains('a4-sheet--blank')).toBe(true);
      expect(rendered.filter((s) => s.classList.contains('a4-sheet--last'))).toEqual([rendered[3]]);
      expect(rendered[0].querySelector('.a4-footer__page')?.textContent).toBe('1 / 4');
    });

    it('onLayout 은 그린 낱장 수를 알리고, 같은 배치로 다시 그려도 또 부르지 않는다', () => {
      const onLayout = vi.fn();
      const { rerender, container } = render(chapterDoc({ padPagesTo: 4, onLayout }));
      // 블록마다 놓인 쪽도 함께 — 2장은 'odd' 로 끼운 빈 쪽(2쪽) 다음 3쪽(인덱스 2)
      expect(onLayout).toHaveBeenLastCalledWith({ pageCount: 4, blockPages: [0, 2] });
      expect(sheets(container)).toHaveLength(4);
      const calls = onLayout.mock.calls.length;
      rerender(chapterDoc({ padPagesTo: 4, onLayout }));
      expect(onLayout.mock.calls.length).toBe(calls);
    });
  });
});
