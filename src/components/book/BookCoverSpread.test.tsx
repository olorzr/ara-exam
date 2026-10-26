import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { renderCoverSlots } from '@/components/problem-paper/PaperCoverPage';
import { coverSpreadGeometry, DEFAULT_BOOK_COVER, resolveSpineInk, spineFontOf } from '@/lib/book';
import BookCoverSpread from './BookCoverSpread';

const NAVY = '#1f3a5f';
const NAVY_RGB = 'rgb(31, 58, 95)';

let style: HTMLStyleElement;
beforeEach(() => {
  const dir = join(process.cwd(), 'src/styles/paper-covers');
  style = document.createElement('style');
  style.textContent = [
    readFileSync(join(process.cwd(), 'src/styles/print-a4.css'), 'utf8'),
    readFileSync(join(process.cwd(), 'src/styles/problem-paper.css'), 'utf8'),
    readFileSync(join(process.cwd(), 'src/styles/paper-cover.css'), 'utf8'),
    ...readdirSync(dir).filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(dir, f), 'utf8')),
    readFileSync(join(process.cwd(), 'src/styles/book-cover.css'), 'utf8'),
  ].join('\n');
  document.head.appendChild(style);
});
afterEach(() => style.remove());

function renderSpread(
  spineMm: number,
  opts: { back?: boolean; backFill?: 'white' | 'spine'; title?: string; font?: string; ink?: string } = {},
) {
  const cover = { ...DEFAULT_BOOK_COVER, backKind: opts.back ? 'design' as const : 'none' as const };
  const slots = renderCoverSlots({ cover, paperTitle: '국어 문학', suffix: '', year: '2026' });
  return render(
    <BookCoverSpread
      geometry={coverSpreadGeometry(spineMm)}
      spineColor={NAVY}
      spineInk={resolveSpineInk(NAVY, opts.ink ?? 'auto')}
      spineTitle={opts.title ?? '국어 문학'}
      spineFont={spineFontOf(opts.font ?? 'gmarket')}
      front={slots.coverPage}
      back={slots.backCoverPage}
      backFill={opts.backFill ?? 'white'}
    />,
  ).container;
}

describe('BookCoverSpread', () => {
  it('용지 크기를 작업사이즈로 덮고 여백은 0 이다 — 200쪽·미색 80g 은 436 × 303mm', () => {
    const root = renderSpread(9.5);
    expect(root.querySelector('style[data-book-cover-page]')!.textContent)
      .toBe('@media print { @page { size: 436mm 303mm; margin: 0; } }');
    const section = root.querySelector<HTMLElement>('.book-cover')!;
    expect(section.style.width).toBe('436mm');
    expect(section.style.height).toBe('303mm');
    // 구역 사이 머리카락 틈이 흰 줄로 보이지 않게 바탕은 책등 색
    expect(section.style.background).toContain(NAVY_RGB);
  });

  it('왼쪽부터 뒷표지 · 책등 · 앞표지 — 자리가 기하와 같다', () => {
    const root = renderSpread(9.5);
    expect(root.querySelector<HTMLElement>('.book-cover__back')!.style.width).toBe('213.25mm');
    const spine = root.querySelector<HTMLElement>('.book-cover__spine')!;
    expect(spine.style.left).toBe('213.25mm');
    expect(spine.style.width).toBe('9.5mm');
    expect(root.querySelector<HTMLElement>('.book-cover__front')!.style.left).toBe('222.75mm');
  });

  it('좁은 화면에서도 펼침면은 줄어들지 않고(구역이 잘리지 않게) 감싼 칸이 가로로 넘긴다', () => {
    const root = renderSpread(9.5);
    expect(getComputedStyle(root.querySelector('.book-cover')!).flexShrink).toBe('0');
    const wrap = document.createElement('div');
    wrap.className = 'book-cover-stack';
    document.body.appendChild(wrap);
    expect(getComputedStyle(wrap).overflowX).toBe('auto');
    wrap.remove();
  });

  it('펼침면 안에는 .a4-sheet 가 없다 — 쪽 넘김 규칙이 걸려 빈 장이 붙지 않게', () => {
    expect(renderSpread(9.5).querySelector('.a4-sheet')).toBeNull();
  });

  it('앞표지 자리는 210 × 297mm 세로 flex 상자이고 그 안에 표지 디자인이 그려진다', () => {
    const page = renderSpread(9.5).querySelector<HTMLElement>('.book-cover__front .book-cover__page')!;
    expect(page.style.width).toBe('210mm');
    expect(page.style.height).toBe('297mm');
    expect(page.style.top).toBe('3mm');
    const cs = getComputedStyle(page);
    expect(cs.display).toBe('flex');
    expect(cs.flexDirection).toBe('column');
    expect(page.querySelector('.pb-cover')).not.toBeNull();
    expect(page.textContent).toContain('국어 문학');
  });

  it('책등은 준 색이고 글자색은 대비가 큰 쪽(남색 → 흰색)', () => {
    const spine = renderSpread(9.5).querySelector<HTMLElement>('.book-cover__spine')!;
    expect(spine.style.background).toContain(NAVY_RGB);
    expect(spine.style.color).toBe('rgb(255, 255, 255)');
    expect(spine.querySelector('.book-spine__title')!.textContent).toBe('국어 문학');
    expect(spine.querySelector('.book-spine__brand')!.textContent).toBe('아라국어논술');
    expect(getComputedStyle(spine.querySelector('.book-spine__title')!).writingMode).toBe('vertical-rl');
  });

  it('제목은 고른 글꼴, 아래쪽 학원 이름은 늘 지마켓 산스 Bold(학원 로고 글꼴)', () => {
    const spine = renderSpread(9.5, { font: 'jua' }).querySelector<HTMLElement>('.book-cover__spine')!;
    const title = spine.querySelector<HTMLElement>('.book-spine__title')!;
    expect(title.style.fontFamily.startsWith('"Jua"')).toBe(true);
    expect(title.style.fontWeight).toBe('400');
    const brand = getComputedStyle(spine.querySelector('.book-spine__brand')!);
    expect(brand.fontFamily).toContain('Gmarket Sans');
    expect(brand.fontWeight).toBe('700');
    const back = renderSpread(9.5, { backFill: 'spine', font: 'nanumpen' }).querySelector('.book-cover__brand')!;
    expect(getComputedStyle(back).fontFamily).toContain('Gmarket Sans');
    expect(getComputedStyle(back).fontWeight).toBe('700');
  });

  it('고른 글자색은 책등 제목·학원 이름과 책등 색 뒷표지의 학원 이름에 함께 찍힌다', () => {
    const root = renderSpread(9.5, { ink: '#a8325e', backFill: 'spine' });
    expect(root.querySelector<HTMLElement>('.book-cover__spine')!.style.color).toBe('rgb(168, 50, 94)');
    expect(root.querySelector<HTMLElement>('.book-cover__brand')!.style.color).toBe('rgb(168, 50, 94)');
    // 흰 뒷표지의 학원 이름은 그대로 회색
    const white = renderSpread(9.5, { ink: '#a8325e' }).querySelector<HTMLElement>('.book-cover__brand')!;
    expect(white.style.color).toBe('rgb(75, 85, 99)');
  });

  it('책등 색 뒷표지는 책등 색이 마침 흰색이어도 고른 글자색이다 — 회색은 흰 바탕을 고른 때만(코덱스 2026-10-26 1R)', () => {
    const cover = { ...DEFAULT_BOOK_COVER, backKind: 'none' as const };
    const slots = renderCoverSlots({ cover, paperTitle: '국어 문학', suffix: '', year: '2026' });
    const root = render(
      <BookCoverSpread
        geometry={coverSpreadGeometry(9.5)} spineColor="#ffffff" spineInk="#a8325e" spineTitle="국어 문학"
        spineFont={spineFontOf('gmarket')} front={slots.coverPage} back={slots.backCoverPage} backFill="spine"
      />,
    ).container;
    expect(root.querySelector<HTMLElement>('.book-cover__brand')!.style.color).toBe('rgb(168, 50, 94)');
  });

  it('책등이 4mm 보다 얇으면 글자를 찍지 않는다', () => {
    expect(renderSpread(3.5).querySelector('.book-spine')).toBeNull();
    expect(renderSpread(12).querySelector('.book-spine')).not.toBeNull();
  });

  it('긴 책등 제목은 짧은 제목보다 작게 찍힌다', () => {
    const size = (title: string) => parseFloat(
      renderSpread(9.5, { title }).querySelector<HTMLElement>('.book-spine__title')!.style.fontSize,
    );
    expect(size('2026 고등 1학년 2학기 기말고사 대비 현대시 고전시가 현대소설 기출 모음 · 교사용')).toBeLessThan(size('문학'));
  });

  it('뒷표지 — 고른 뒷표지가 있으면 그것을 흰 바탕에, 없으면 바탕 선택(흰색/책등 색)에 학원 이름', () => {
    const withBack = renderSpread(9.5, { back: true, backFill: 'spine' }).querySelector<HTMLElement>('.book-cover__back')!;
    expect(withBack.querySelector('.book-cover__page')).not.toBeNull();
    expect(withBack.style.background).toContain('rgb(255, 255, 255)');

    const colored = renderSpread(9.5, { backFill: 'spine' }).querySelector<HTMLElement>('.book-cover__back')!;
    expect(colored.style.background).toContain(NAVY_RGB);
    expect(colored.querySelector('.book-cover__brand')!.textContent).toBe('아라국어논술');

    const white = renderSpread(9.5).querySelector<HTMLElement>('.book-cover__back')!;
    expect(white.style.background).toContain('rgb(255, 255, 255)');
  });

  it('재단선·접는 선은 인쇄되지 않는다', () => {
    const guides = renderSpread(9.5).querySelector('.book-cover__guides')!;
    expect(guides.hasAttribute('data-no-print')).toBe(true);
    expect(guides.querySelectorAll('.book-cover__fold')).toHaveLength(2);
  });
});
