import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import A4CoverSheet from './A4CoverSheet';
import A4Sheet from './A4Sheet';
import BookletStack from './BookletStack';
import {
  A4_HEIGHT_PX, A4_WIDTH_PX, BOOKLET_SIDE_HEIGHT_PX, BOOKLET_SIDE_SLACK_PX, PAGE_PAD_BOTTOM,
} from '@/lib/print/constants';

function pages(n: number) {
  return Array.from({ length: n }, (_, i) => <div key={i} className="dummy">{i + 1}쪽</div>);
}

/** 면마다 [왼쪽, 오른쪽] 자리의 data-page */
function faces(container: HTMLElement): string[][] {
  return Array.from(container.querySelectorAll('.booklet-side')).map((side) =>
    Array.from(side.querySelectorAll<HTMLElement>('[data-slot]')).map((slot) => slot.dataset.page ?? ''));
}

describe('BookletStack', () => {
  it('5쪽 — 2장 4면, 빈 면은 끝 쪽 자리에만', () => {
    const { container } = render(<BookletStack pages={pages(5)} />);
    expect(faces(container)).toEqual([
      ['blank', '1'],
      ['2', 'blank'],
      ['blank', '3'],
      ['4', '5'],
    ]);
    expect(container.querySelectorAll('.booklet-blank')).toHaveLength(3);
  });

  it('뒷표지 — 마지막 쪽을 책의 맨 뒤 자리에 두고 빈 면은 그 앞에, 캡션은 뒷표지라고 적는다', () => {
    const { container } = render(<BookletStack pages={pages(5)} backCover />);
    expect(faces(container)).toEqual([
      ['5', '1'],
      ['2', 'blank'],
      ['blank', '3'],
      ['4', 'blank'],
    ]);
    expect(container.querySelector('.booklet-leaf__caption')!.textContent).toContain('왼쪽 뒷표지');
  });

  it('앞표지 — 빈 면이 있으면 표지 바로 뒤를 비우고, 캡션은 앞표지라고 적는다', () => {
    const { container } = render(<BookletStack pages={pages(5)} frontCover backCover />);
    expect(faces(container)).toEqual([
      ['5', '1'],
      ['blank', 'blank'],
      ['blank', '2'],
      ['3', '4'],
    ]);
    const first = container.querySelector('.booklet-leaf__caption')!.textContent;
    expect(first).toContain('왼쪽 뒷표지');
    expect(first).toContain('오른쪽 앞표지');
  });

  it('앞표지 — 쪽 수가 4의 배수면 빈 면 없이 그대로다', () => {
    const { container } = render(<BookletStack pages={pages(4)} frontCover backCover />);
    expect(faces(container)).toEqual([['4', '1'], ['2', '3']]);
    expect(container.querySelectorAll('.booklet-blank')).toHaveLength(0);
  });

  it('면 안의 자리에 그 쪽 내용을 그린다', () => {
    const { container } = render(<BookletStack pages={pages(4)} />);
    const first = container.querySelector('.booklet-side')!;
    expect(first.querySelector('[data-slot="left"]')!.textContent).toBe('4쪽');
    expect(first.querySelector('[data-slot="right"]')!.textContent).toBe('1쪽');
  });

  it('마지막 면에만 쪽 넘김을 끄는 클래스가 붙는다', () => {
    const { container } = render(<BookletStack pages={pages(8)} />);
    const sides = Array.from(container.querySelectorAll('.booklet-side'));
    expect(sides).toHaveLength(4);
    expect(sides.filter((s) => s.classList.contains('booklet-side--last'))).toEqual([sides[3]]);
  });

  it('캡션은 인쇄되지 않고 장·면을 밝힌다', () => {
    const { container } = render(<BookletStack pages={pages(4)} />);
    const captions = Array.from(container.querySelectorAll('.booklet-leaf__caption'));
    expect(captions.map((c) => c.hasAttribute('data-no-print'))).toEqual([true, true]);
    expect(captions[0].textContent).toContain('1장 앞면');
    expect(captions[1].textContent).toContain('1장 뒷면');
  });

  it('양면을 긴 쪽으로 넘기면 뒷면에만 돌림 표시가 붙고, 캡션이 알린다(쪽 배치는 그대로)', () => {
    const { container } = render(<BookletStack pages={pages(8)} duplex="long" />);
    const sides = Array.from(container.querySelectorAll<HTMLElement>('.booklet-side'));
    const turned = sides.map((s) => s.classList.contains('booklet-side--turned'));
    expect(turned).toEqual([false, true, false, true]);
    // 돌리는 것은 인쇄 CSS 몫이다 — 자리 배정(data-slot)은 짧은 쪽과 똑같다
    expect(faces(container)).toEqual([['8', '1'], ['2', '7'], ['6', '3'], ['4', '5']]);
    const captions = Array.from(container.querySelectorAll('.booklet-leaf__caption')).map((c) => c.textContent);
    expect(captions.filter((c) => c!.includes('거꾸로'))).toEqual([captions[1], captions[3]]);
    // 마지막 면 표시와 함께 붙는다
    expect(sides[3].classList.contains('booklet-side--last')).toBe(true);
  });

  it('짧은 쪽(처음 값)이면 어느 면도 돌리지 않는다', () => {
    for (const props of [{}, { duplex: 'short' as const }]) {
      const { container, unmount } = render(<BookletStack pages={pages(8)} {...props} />);
      expect(container.querySelectorAll('.booklet-side--turned')).toHaveLength(0);
      expect(container.textContent).not.toContain('거꾸로');
      unmount();
    }
  });

  it('긴 쪽이어도 앞·뒤표지는 돌리지 않는 1장 앞면에 있다', () => {
    const { container } = render(
      <BookletStack
        frontCover backCover duplex="long"
        pages={[
          <A4CoverSheet key="c"><div>표지</div></A4CoverSheet>,
          ...pages(3),
          <A4CoverSheet key="b" side="back" isLast><div>뒷표지</div></A4CoverSheet>,
        ]}
      />,
    );
    for (const cover of container.querySelectorAll('.a4-sheet--cover')) {
      expect(cover.closest('.booklet-side')!.classList.contains('booklet-side--turned')).toBe(false);
    }
  });

  it('인쇄 용지를 A3 가로로 덮는 규칙을 함께 그린다', () => {
    const { container } = render(<BookletStack pages={pages(2)} />);
    expect(container.querySelector('style[data-booklet-page]')!.textContent).toContain('A3 landscape');
  });

  it('면·빈 면의 크기는 상수에서 온다(CSS 에 숫자를 복사하지 않는다)', () => {
    const { container } = render(<BookletStack pages={pages(1)} />);
    const side = container.querySelector<HTMLElement>('.booklet-side')!;
    expect(side.style.width).toBe(`${A4_WIDTH_PX * 2}px`);
    expect(side.style.height).toBe(`${BOOKLET_SIDE_HEIGHT_PX}px`);
    const blank = container.querySelector<HTMLElement>('.booklet-blank')!;
    expect(blank.style.width).toBe(`${A4_WIDTH_PX}px`);
    expect(blank.style.height).toBe(`${A4_HEIGHT_PX}px`);
  });

  // 면이 쪽 높이와 같으면 프린터 여백(크롬 '여백: 기본값')만큼 넘쳐 면마다 빈 쪽이 붙는다 — 2026-10-13 사고
  it('면은 쪽보다 낮고, 깎는 여유는 푸터 아래 여백 안이다', () => {
    expect(BOOKLET_SIDE_HEIGHT_PX).toBeLessThan(A4_HEIGHT_PX);
    expect(BOOKLET_SIDE_SLACK_PX).toBeGreaterThan(0);
    expect(BOOKLET_SIDE_SLACK_PX).toBeLessThan(PAGE_PAD_BOTTOM);
  });

  it('여유 40px 이면 프린터 여백 10mm 까지 폭에 맞춰 줄인 면이 쪽 높이에 들어간다', () => {
    const MM = 96 / 25.4;
    const pageW = 420 * MM;
    const pageH = 297 * MM;
    for (const marginMm of [0, 4, 5, 6.35, 10]) {
      const m = marginMm * MM;
      const sideW = A4_WIDTH_PX * 2;
      const shrink = Math.min(1, (pageW - 2 * m) / sideW);
      expect(BOOKLET_SIDE_HEIGHT_PX * shrink).toBeLessThanOrEqual(pageH - 2 * m);
    }
  });
});

/**
 * 실제 인쇄 CSS 를 문서에 얹고 계산된 스타일로 본다 — jsdom 은 배치를 못 하지만 캐스케이드는 한다.
 * 쪽 번호 자리·표지 높이처럼 CSS 한 줄이 지키는 것을 상수 테스트로는 못 지킨다(코덱스 1R).
 */
describe('BookletStack — 인쇄 CSS', () => {
  let style: HTMLStyleElement;
  beforeEach(() => {
    style = document.createElement('style');
    style.textContent = ['print-a4.css', 'print-booklet.css']
      .map((f) => readFileSync(join(process.cwd(), 'src/styles', f), 'utf8')).join('\n');
    document.head.appendChild(style);
  });
  afterEach(() => style.remove());

  const bodyPage = (n: number, total: number) => (
    <A4Sheet key={n} page={n} total={total}><div>{n}쪽</div></A4Sheet>
  );

  it('쪽 번호는 바깥쪽 아래 — 왼쪽 면은 1열(왼쪽 끝), 오른쪽 면은 3열(오른쪽 끝), 둘 다 한 줄', () => {
    const { container } = render(<BookletStack pages={[1, 2, 3, 4].map((n) => bodyPage(n, 4))} />);
    const number = (slot: 'left' | 'right') => getComputedStyle(
      container.querySelector(`.booklet-side [data-slot="${slot}"] .a4-footer__page`)!,
    );
    expect(number('left').gridColumn).toBe('1');
    expect(number('left').justifySelf).toBe('start');
    // ⚠️ 줄을 못박지 않으면 자동 배치가 1열 항목을 다음 줄로 보내 푸터가 두 줄이 된다
    expect(number('left').gridRow).toBe('1');
    expect(number('right').gridColumn).toBe('3');
    expect(number('right').justifySelf).toBe('end');
  });

  // jsdom 은 @media print 를 계산하지 않아 글자로 본다
  it('뒷면 돌리기는 인쇄에서만 — 자리 맞바꿈 + 낱장마다 180°, 면 자체는 돌리지 않는다', () => {
    const css = readFileSync(join(process.cwd(), 'src/styles/print-booklet.css'), 'utf8');
    const printAt = css.indexOf('@media print');
    expect(printAt).toBeGreaterThan(0);
    // 인쇄 블록 앞(주석 밖)에는 없어야 한다 — 화면 미리보기는 똑바로 둔다
    expect(css.slice(0, printAt).replace(/\/\*[\s\S]*?\*\//g, '')).not.toContain('booklet-side--turned');
    const print = css.slice(printAt);
    expect(print).toMatch(/\.booklet-side--turned\s*\{\s*flex-direction:\s*row-reverse;\s*\}/);
    expect(print).toMatch(/\.booklet-side--turned > \.booklet-slot > \*\s*\{\s*transform:\s*rotate\(180deg\);\s*\}/);
    // ⚠️ 면을 통째로 돌리면 깎인 40px 자리가 종이 위로 올라가 뒷면이 앞면과 어긋난다
    expect(print).not.toMatch(/\.booklet-side--turned\s*\{[^}]*transform/);
  });

  it('표지·뒷표지는 면 높이를 따르고(그림이 잘리지 않게), 본문 낱장은 A4 높이 그대로다', () => {
    const { container } = render(
      <BookletStack
        backCover
        pages={[
          <A4CoverSheet key="c"><div>표지</div></A4CoverSheet>, bodyPage(1, 1),
          <A4CoverSheet key="b" side="back" isLast><div>뒷표지</div></A4CoverSheet>,
        ]}
      />,
    );
    const covers = Array.from(container.querySelectorAll<HTMLElement>('.a4-sheet--cover'));
    expect(covers).toHaveLength(2);
    for (const cover of covers) expect(getComputedStyle(cover).height).toBe('auto');
    const body = container.querySelector<HTMLElement>('.a4-sheet:not(.a4-sheet--cover)')!;
    expect(getComputedStyle(body).height).toBe(`${A4_HEIGHT_PX}px`);
  });
});
