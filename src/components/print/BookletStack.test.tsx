import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import BookletStack from './BookletStack';
import { A4_HEIGHT_PX, A4_WIDTH_PX } from '@/lib/print/constants';

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

  it('인쇄 용지를 A3 가로로 덮는 규칙을 함께 그린다', () => {
    const { container } = render(<BookletStack pages={pages(2)} />);
    expect(container.querySelector('style[data-booklet-page]')!.textContent).toContain('A3 landscape');
  });

  it('면·빈 면의 크기는 상수에서 온다(CSS 에 숫자를 복사하지 않는다)', () => {
    const { container } = render(<BookletStack pages={pages(1)} />);
    const side = container.querySelector<HTMLElement>('.booklet-side')!;
    expect(side.style.width).toBe(`${A4_WIDTH_PX * 2}px`);
    expect(side.style.height).toBe(`${A4_HEIGHT_PX}px`);
    const blank = container.querySelector<HTMLElement>('.booklet-blank')!;
    expect(blank.style.width).toBe(`${A4_WIDTH_PX}px`);
  });
});
