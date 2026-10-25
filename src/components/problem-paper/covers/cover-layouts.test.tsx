import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { COVER_LAYOUTS } from '@/lib/problem-paper/cover';
import { toCoverLayoutProps } from '@/lib/problem-paper/cover-text';
import { BackCover, COVER_LAYOUT_COMPONENTS } from '.';

const PROPS = toCoverLayoutProps({
  title: '현대시 읽기',
  subtitle: '고등 1학년 · 국어 · 2학기\n화자와 정서\n이미지와 감각',
  showNameBox: true,
  year: '2026',
  teacher: '송알',
});
const DESIGNS = COVER_LAYOUTS.filter((l) => l !== 'basic');

function renderLayout(layout: (typeof COVER_LAYOUTS)[number], props = PROPS) {
  const Layout = COVER_LAYOUT_COMPONENTS[layout];
  return render(<Layout {...props} />).container;
}

describe('디자인 표지 — 글이 자리에 들어간다', () => {
  it.each(COVER_LAYOUTS)('%s — 제목·과정·단원이 찍힌다', (layout) => {
    const text = renderLayout(layout).textContent ?? '';
    expect(text).toContain('현대시 읽기');
    expect(text).toContain('고등 1학년');
    expect(text).toContain('화자와 정서');
    expect(text).toContain('이미지와 감각');
  });

  it.each(DESIGNS)('%s — 연도를 찍고, 시안의 회차 표기·옛 영문 상표는 옮기지 않았다', (layout) => {
    const text = renderLayout(layout).textContent ?? '';
    expect(text).toContain('2026');
    for (const old of ['제 3 회', 'vol.', 'No. 03', 'Poetry', '2학기 · 제', 'ARA KOREAN', 'Korean & Essay', 'ara.']) {
      expect(text).not.toContain(old);
    }
  });

  it.each(DESIGNS)('%s — 학생 빈칸은 이름 칸 체크를 따르고, 날짜 칸은 없다', (layout) => {
    const on = renderLayout(layout);
    expect(on.textContent).toContain('학생');
    expect(on.querySelector('.pbc-field')).not.toBeNull();
    expect(on.textContent).not.toContain('날짜');
    const off = renderLayout(layout, { ...PROPS, showNameBox: false });
    expect(off.textContent).not.toContain('학생');
    expect(off.querySelector('.pbc-field')).toBeNull();
  });

  it.each(DESIGNS)('%s — 선생님 이름은 있을 때만 찍는다(이름 칸 체크와 무관)', (layout) => {
    const on = renderLayout(layout, { ...PROPS, showNameBox: false }).textContent ?? '';
    expect(on).toContain('선생님');
    expect(on).toContain('송알');
    const off = renderLayout(layout, { ...PROPS, teacher: '' }).textContent ?? '';
    expect(off).not.toContain('선생님');
  });

  it('간단 표지는 예전 이름 칸(학교 · 학년 반 · 이름)을 그대로 쓰고 선생님 줄이 없다', () => {
    const text = renderLayout('basic').textContent ?? '';
    expect(text).toContain('이름');
    expect(text).not.toContain('송알');
    expect(renderLayout('basic', { ...PROPS, showNameBox: false }).textContent).not.toContain('이름');
  });

  it.each(DESIGNS)('%s — 연도·과정·단원·선생님이 비어도 그린다', (layout) => {
    const empty = toCoverLayoutProps({ title: '봄봄', subtitle: '', showNameBox: false, year: '' });
    const root = renderLayout(layout, empty).firstElementChild as HTMLElement;
    expect(root.classList.contains('pb-cover--layout')).toBe(true);
    expect(root.textContent).toContain('봄봄');
  });

  it('제목 배율을 CSS 변수로 넘기고, 길면 줄인다', () => {
    const scaleOf = (title: string) => Number(
      (renderLayout('editorial', { ...PROPS, title }).firstElementChild as HTMLElement)
        .style.getPropertyValue('--pbc-title-scale'),
    );
    expect(scaleOf('현대시 읽기')).toBe(1);
    expect(scaleOf('2학기 중간고사 대비 현대시 3회 - 교사용')).toBeLessThan(scaleOf('현대시 읽기'));
  });

  it('에디토리얼 — 단원은 제목 아래 괄호 줄, 표는 선생님·학생 두 줄', () => {
    const root = renderLayout('editorial');
    expect(root.querySelector('.pbc-editorial__topics-text')!.textContent).toBe('화자와 정서 · 이미지와 감각');
    expect(Array.from(root.querySelectorAll('.pbc-editorial__row dt')).map((d) => d.textContent)).toEqual(['선생님', '학생']);
    expect(root.querySelectorAll('.pbc-editorial__fill-col')).toHaveLength(4);
    expect(root.querySelector('.pbc-editorial__fill-col')!.textContent).toContain('읽고, 묻고, 다시 읽는다.');
  });

  it('책등 — 제목 책등 셋이 길이에 맞춰 줄어들고, 단원은 번호 목록이다', () => {
    const spineScales = (title: string) => Array.from(
      renderLayout('spines', { ...PROPS, title }).querySelectorAll<HTMLElement>('.pbc-spines__spine'),
    ).map((el) => el.style.getPropertyValue('--pbc-spine-scale')).filter(Boolean).map(Number);
    expect(spineScales('봄봄')).toEqual([1, 1, 1]);
    const long = spineScales('가'.repeat(60));
    expect(long).toHaveLength(3);
    long.forEach((s) => expect(s).toBeLessThan(1));
    const root = renderLayout('spines');
    expect(root.querySelector('.pbc-spines__title')!.textContent).toBe('현대시 읽기');
    expect(Array.from(root.querySelectorAll('.pbc-spines__item-no')).map((n) => n.textContent)).toEqual(['01', '02']);
  });

  it('스케치 — 단원은 한 줄, 화살표는 선생님·학생 칸이 둘 다 있을 때만', () => {
    const both = renderLayout('sketch');
    expect(both.querySelector('.pbc-sketch__topics')!.textContent).toBe('화자와 정서 · 이미지와 감각');
    expect(both.querySelectorAll('.pbc-sketch__doodle--arrow')).toHaveLength(1);
    expect(renderLayout('sketch', { ...PROPS, teacher: '' }).querySelectorAll('.pbc-sketch__doodle--arrow')).toHaveLength(0);
    expect(renderLayout('sketch', { ...PROPS, showNameBox: false }).querySelectorAll('.pbc-sketch__doodle--arrow'))
      .toHaveLength(0);
  });

  it('부제 줄이 아주 많아도(한 글자 40줄) 간단 표지는 줄 수가 상한 안이고 책등 목록은 여섯 줄이다', () => {
    const many = toCoverLayoutProps({
      title: '현대시', subtitle: ['과정', ...Array.from({ length: 40 }, (_, i) => `${i}`)].join('\n'),
      showNameBox: true, year: '2026',
    });
    const basic = renderLayout('basic', many).querySelector('.pb-cover__subtitle')!;
    expect(basic.textContent!.split('\n')).toHaveLength(1 + 6);
    expect(renderLayout('spines', many).querySelectorAll('.pbc-spines__item')).toHaveLength(6);
  });

  it('블러 — 제목이 길어 작아지면 단원 줄 글자도 그보다 크지 않다', () => {
    const root = renderLayout('soft', { ...PROPS, title: '2학기 중간고사 대비 현대시 3회 - 교사용' })
      .firstElementChild as HTMLElement;
    const title = Number(root.style.getPropertyValue('--pbc-title-scale'));
    const topic = Number(root.style.getPropertyValue('--pbc-topic-scale'));
    expect(28 * topic).toBeLessThanOrEqual(112 * title);
  });

  it('블러 — 단원은 제목 아래 한 줄, 바닥 글은 선생님 · 상표 줄', () => {
    const root = renderLayout('soft');
    expect(root.querySelector('.pbc-soft__topics')!.textContent).toBe('화자와 정서 · 이미지와 감각');
    expect(root.querySelector('.pbc-soft__note')!.textContent).toContain('송알');
    expect(root.querySelector('.pbc-soft__vertical')!.textContent).toContain('2026');
  });

  it('라인드로잉 — 상자 셋 · 모서리 라벨 · 선 그림이 그려진다', () => {
    const root = renderLayout('zine');
    expect(root.querySelectorAll('.pbc-zine__box')).toHaveLength(3);
    expect(root.querySelector('.pbc-zine__label')!.textContent).toBe('화자와 정서 · 이미지와 감각');
    expect(root.querySelectorAll('svg path').length).toBeGreaterThan(60);
    expect(root.querySelector('.pbc-zine__year')!.textContent).toContain('2026.—');
  });
});

describe('디자인 뒷표지', () => {
  it.each(COVER_LAYOUTS)('%s — 상표 · 저작권 안내 · 연도를 찍고 그 디자인의 짝이다', (layout) => {
    const root = render(<BackCover layout={layout} year="2026" />).container.firstElementChild as HTMLElement;
    expect(root.classList.contains(`pbc-back--${layout}`)).toBe(true);
    expect(root.textContent).toContain('아라국어논술');
    expect(root.textContent).toContain('외부 배포를 금합니다');
    expect(root.textContent).toContain('© 2026 아라국어논술');
  });

  it('연도를 모르면 © 뒤에 바로 상표', () => {
    const root = render(<BackCover layout="rings" year="" />).container;
    expect(root.textContent).toContain('© 아라국어논술');
  });
});

/**
 * 실제 CSS 를 얹어 계산된 스타일로 본다(BookletStack.test.tsx 와 같은 방식). 중철에서는 표지가 면 높이
 * (A4 − 40px)로 줄어드므로 표지 뿌리에 높이가 박히면 안 되고, 바닥 근처를 top 으로 잡으면 잘린다.
 */
describe('디자인 표지 — 인쇄 CSS', () => {
  const dir = join(process.cwd(), 'src/styles/paper-covers');
  const files = readdirSync(dir).filter((f) => f.endsWith('.css'));
  let style: HTMLStyleElement;
  beforeEach(() => {
    style = document.createElement('style');
    // 문제지 범위(.pb-sheet)를 먼저 얹는다 — 앱에서 표지 낱장에도 그 클래스가 붙어 규칙이 새어 든다
    style.textContent = [
      readFileSync(join(process.cwd(), 'src/styles/problem-paper.css'), 'utf8'),
      readFileSync(join(process.cwd(), 'src/styles/paper-cover.css'), 'utf8'),
      ...files.map((f) => readFileSync(join(dir, f), 'utf8')),
    ].join('\n');
    document.head.appendChild(style);
  });
  afterEach(() => style.remove());

  it('디자인마다 CSS 파일이 있다', () => {
    for (const layout of DESIGNS) expect(files).toContain(`${layout}.css`);
  });

  it.each(DESIGNS)('%s — 뿌리는 낱장을 채우되 높이를 쓰지 않는다', (layout) => {
    const root = renderLayout(layout).firstElementChild as HTMLElement;
    const css = getComputedStyle(root);
    expect(css.position).toBe('relative');
    expect(css.overflow).toBe('hidden');
    expect(css.flexGrow).toBe('1');
    expect(['', 'auto']).toContain(css.height);
  });

  it.each(COVER_LAYOUTS)('%s 뒷표지 — 뿌리는 낱장을 채우되 높이를 쓰지 않고 배경은 흰색', (layout) => {
    const root = render(<BackCover layout={layout} year="2026" />).container.firstElementChild as HTMLElement;
    const css = getComputedStyle(root);
    expect(css.position).toBe('relative');
    expect(css.flexGrow).toBe('1');
    expect(['', 'auto']).toContain(css.height);
    expect(css.backgroundColor).toBe('rgb(255, 255, 255)');
  });

  it('스케치 테두리는 네 변 기준(시안의 1,087px 고정 높이 아님)', () => {
    const frame = renderLayout('sketch').querySelector<HTMLElement>('.pbc-sketch__frame')!;
    const css = getComputedStyle(frame);
    expect([css.top, css.bottom, css.left, css.right]).toEqual(['18px', '18px', '18px', '18px']);
    expect(['', 'auto']).toContain(css.height);
  });

  it('기본 여백 지우기가 디자인의 여백을 덮지 않는다(초기화는 특이성 0)', () => {
    const spines = renderLayout('spines').querySelector<HTMLElement>('.pbc-spines__list')!;
    expect(getComputedStyle(spines).marginTop).toBe('14px');
    const body = renderLayout('spines').querySelector<HTMLElement>('.pbc-spines__body')!;
    expect(getComputedStyle(body).marginTop).toBe('54px');
    const soft = renderLayout('soft').querySelector<HTMLElement>('.pbc-soft__tagline')!;
    expect(getComputedStyle(soft).paddingTop).toBe('80px');
  });

  it('문제지 범위(.pb-sheet) 안에서도 p 여백·글자 크기·줄 높이가 새어 들지 않는다(코덱스 3R)', () => {
    const Layout = COVER_LAYOUT_COMPONENTS.soft;
    const { container } = render(<section className="pb-sheet pb-sheet--paper"><Layout {...PROPS} /></section>);
    const root = container.querySelector<HTMLElement>('.pb-cover--layout')!;
    expect(getComputedStyle(root).fontSize).toBe('16px');
    expect(getComputedStyle(root).lineHeight).toBe('1.3');
    const tagline = container.querySelector<HTMLElement>('.pbc-soft__tagline')!;
    expect(getComputedStyle(tagline).marginTop).toBe('0px');
    expect(getComputedStyle(tagline).marginBottom).toBe('0px');
    expect(getComputedStyle(tagline).paddingTop).toBe('80px');
  });

  it('링의 글 줄기는 비율 빈 칸으로 늘고 준다(시안의 margin 누적 아님)', () => {
    const root = renderLayout('rings');
    expect(getComputedStyle(root.querySelector('.pbc-rings__flow')!).display).toBe('flex');
    const gap = getComputedStyle(root.querySelector('.pbc-rings__gap--1')!);
    expect(gap.flexGrow).toBe('190');
    expect(gap.flexBasis).toBe('0px');
  });

  it('배경은 흰색이고 누런 기 있는 회색이 없다 — 색은 모두 무채색(사용자 결정 2026-10-14 \'누런 건 싫어\')', () => {
    for (const layout of DESIGNS) {
      const root = renderLayout(layout).firstElementChild as HTMLElement;
      expect(getComputedStyle(root).backgroundColor, layout).toBe('rgb(255, 255, 255)');
    }
    // 3·4·6·8자리 HEX 와 rgb()/rgba() 를 모두 R·G·B 로 펴서 견준다(코덱스 — 6자리만 보면 #ffe 가 빠진다)
    const channels = (hex: string): string[] => {
      const h = hex.length <= 4 ? [...hex].map((c) => c + c).join('') : hex;
      return [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)].map((c) => String(parseInt(c, 16)));
    };
    for (const f of files) {
      const css = readFileSync(join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      const colors = [
        ...[...css.matchAll(/#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g)].map(([m, hex]) => [m, channels(hex)] as const),
        ...[...css.matchAll(/rgba?\(([^)]*)\)/g)].map(([m, args]) => [m, args.split(/[\s,/]+/).filter(Boolean).slice(0, 3)] as const),
      ];
      expect(colors.length, f).toBeGreaterThan(0);
      for (const [m, [r, g, b]] of colors) expect(r === g && g === b, `${f} ${m}`).toBe(true);
    }
  });

  it('어느 디자인 CSS 도 면 바닥 근처를 top 으로 잡거나 면을 넘는 높이를 쓰지 않는다', () => {
    for (const f of files) {
      // 주석은 빼고 본다 — 시안 값을 설명하는 주석(예: '시안의 height: 1087px')이 걸리지 않게
      const css = readFileSync(join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const m of css.matchAll(/(?:^|[\s;{])top:\s*(-?\d+)px/g)) {
        expect(Number(m[1]), `${f} top ${m[1]}px`).toBeLessThanOrEqual(800);
      }
      for (const m of css.matchAll(/(?:^|[\s;{])height:\s*(\d+)px/g)) {
        expect(Number(m[1]), `${f} height ${m[1]}px`).toBeLessThanOrEqual(700);
      }
    }
  });
});
