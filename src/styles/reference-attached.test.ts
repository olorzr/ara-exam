import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { chromaticHexColors, printBlock } from './css-test-helpers';

const css = readFileSync(path.resolve(__dirname, 'reference-attached.css'), 'utf8');
const sheet = readFileSync(path.resolve(__dirname, 'reference-sheet.css'), 'utf8');
const mm = (s: string) => Number(s.replace('mm', ''));

describe('reference-attached.css', () => {
  it('인쇄는 회색 한 벌이다', () => {
    expect(chromaticHexColors(printBlock(css))).toEqual([]);
  });

  it('⚠️ 인쇄 두 칸의 폭 합은 보기 화면 인쇄 흉내 폭(178mm)과 같다 — 다르면 구절 풀이 자리를 다른 폭으로 잰다', () => {
    const cols = printBlock(css).match(/grid-template-columns: (\d+)mm (\d+)mm; column-gap: (\d+)mm;/);
    expect(cols).not.toBeNull();
    const [, main, wing, gap] = cols!;
    const full = sheet.match(/\.pb-sheet\.ref-sheet\.ref-sheet--print-metrics \{\s*width: (\d+mm);/)?.[1];
    expect(full).toBe('178mm');
    expect(mm(main) + mm(wing) + mm(gap)).toBe(mm(full!));
    expect(css).toContain(`.ref-page__main > .pb-sheet.ref-sheet.ref-sheet--print-metrics { width: ${main}mm; }`);
    expect(css).toContain(`.ref-page__wing .pb-sheet.ref-sheet.ref-sheet--print-metrics { width: ${wing}mm; }`);
  });

  it('⚠️ 인쇄의 제재 정리 상자는 좌우 안쪽 여백이 없다 — 글 폭이 흉내 폭(178mm)과 같아야 한다(코덱스 2R)', () => {
    const top = printBlock(css).match(/\.ref-attached--top \{([^}]*)\}/)?.[1] ?? '';
    expect(top).toContain('padding: 3mm 0;');
    expect(top).toContain('border-width: 1px 0;');
  });

  it('좁은 화면에서는 여백 칸이 본문 아래로 내려간다', () => {
    const narrow = css.slice(css.indexOf('@media (max-width: 640px)'));
    expect(narrow).toContain('.ref-page__split { grid-template-columns: minmax(0, 1fr);');
  });

  it('여백 글은 인쇄 글자 크기를 변수로 바꾼다 — 인쇄 규칙과 흉내가 같은 값을 읽는다', () => {
    expect(css).toMatch(/\.ref-sheet--wing \{\s*--ref-print-font: 9pt;/);
    expect(sheet).toContain('font-size: var(--ref-print-font)');
  });

  it('⚠️ 화면 글자 크기 규칙이 인쇄와 흉내를 덮지 않는다 — 같은 접두로 인쇄 크기를 다시 건다(코덱스 1R)', () => {
    const screen = '.pb-sheet.pb-sheet--screen.ref-sheet.ref-sheet--wing';
    expect(printBlock(css)).toContain(`${screen} { font-size: var(--ref-print-font); line-height: var(--ref-print-lh); }`);
    expect(css).toContain(`${screen}.ref-sheet--print-metrics { font-size: var(--ref-print-font); line-height: var(--ref-print-lh); }`);
    expect(css.indexOf(`${screen}.ref-sheet--print-metrics`)).toBeGreaterThan(css.indexOf(`${screen} {\n  --ref-print-font`));
  });
});
