import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 주석을 걷는다 — 설명 주석에 `html:root`·`:root` 같은 선택자 글자가 들어 있어, 걷지 않으면 주석 뒤의
 * 엉뚱한 블록을 읽는다(코덱스 2R: 인쇄 블록 대신 화면 블록을 읽어 인쇄 블록을 지워도 통과했다).
 */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

const guard = stripComments(readFileSync(path.resolve(__dirname, 'print-guard.css'), 'utf8'));
const globals = stripComments(readFileSync(path.resolve(__dirname, '../../app/globals.css'), 'utf8'));
const tailwindTheme = readFileSync(
  path.resolve(__dirname, '../../../node_modules/tailwindcss/theme.css'),
  'utf8',
);

/**
 * 화면 테마(2026-11-12) 전 `:root` 의 값 — 인쇄물이 지금까지 이 값으로 찍혔다.
 * 화면 테마가 바꾸는 토큰은 전부 여기 있어야 하고, 가드는 이 값으로 되돌린다.
 */
const LEGACY_ROOT: Record<string, string> = {
  '--background': '#FFFFFF',
  '--foreground': 'oklch(0.145 0 0)',
  '--card': '#FFFFFF',
  '--card-foreground': 'oklch(0.145 0 0)',
  '--popover': '#FFFFFF',
  '--popover-foreground': 'oklch(0.145 0 0)',
  '--primary': '#81D8D0',
  '--primary-hover': '#6bc4bc',
  '--primary-foreground': '#ffffff',
  '--secondary': '#F8FAFB',
  '--secondary-foreground': 'oklch(0.205 0 0)',
  '--muted': '#F8F9FA',
  '--muted-foreground': 'oklch(0.556 0 0)',
  '--accent': '#F0FDFA',
  '--accent-foreground': 'oklch(0.205 0 0)',
  '--destructive': 'oklch(0.58 0.22 27)',
  '--border': '#E5E7EB',
  '--input': '#E5E7EB',
  '--ring': '#81D8D0',
  '--radius': '0.625rem',
};

/** `선택자 { … }` 블록 하나의 커스텀 속성을 읽는다(중괄호 깊이를 센다) */
function declarationsAfter(css: string, marker: string): Record<string, string> {
  const start = css.indexOf(marker);
  if (start < 0) throw new Error(`블록 없음: ${marker}`);
  const open = css.indexOf('{', start);
  let depth = 0;
  let end = open;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') depth -= 1;
    if (depth === 0) { end = i; break; }
  }
  const body = css.slice(open + 1, end);
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

/** `@media print { … }` 블록의 안쪽 글자 */
function printMediaBody(css: string): string {
  const start = css.indexOf('@media print');
  if (start < 0) throw new Error('@media print 블록 없음');
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') depth -= 1;
    if (depth === 0) return css.slice(open + 1, i);
  }
  throw new Error('@media print 블록이 닫히지 않음');
}

const layerBase = guard.slice(guard.indexOf('@layer base'), guard.indexOf('@media print'));
const screenGuard = declarationsAfter(layerBase, ':where(.a4-sheet, .a4-measure, .book-cover)');
const printBody = printMediaBody(guard);
const printGuard = declarationsAfter(printBody, 'html:root');
const root = declarationsAfter(globals.slice(globals.indexOf('\n:root {')), ':root {');

describe('인쇄 가드(print-guard.css)', () => {
  it('화면 미리보기 묶음은 @layer base 안, 인쇄 묶음은 @media print 안의 html:root 다', () => {
    expect(guard.indexOf('@layer base')).toBeGreaterThanOrEqual(0);
    expect(layerBase).toContain(':where(.a4-sheet, .a4-measure, .book-cover)');
    expect(printBody).toContain('html:root');
    expect(Object.keys(printGuard).length).toBeGreaterThan(20);
  });

  it('화면 미리보기 묶음과 인쇄 묶음이 글자 그대로 같다', () => {
    expect(printGuard).toEqual(screenGuard);
  });

  it('회색 계조는 Tailwind 기본값 그대로다 — 종이에 찍히던 회색', () => {
    for (const step of ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']) {
      const key = `--color-gray-${step}`;
      const original = tailwindTheme.match(new RegExp(`${key}:\\s*([^;]+);`))?.[1].trim();
      expect(original, key).toBeTruthy();
      expect(screenGuard[key], key).toBe(original);
    }
  });

  it('되돌리는 토큰은 옛 :root 값 그대로다', () => {
    for (const [key, value] of Object.entries(screenGuard)) {
      if (key.startsWith('--color-gray-')) continue;
      expect(LEGACY_ROOT[key], `${key} 는 옛 값 표에 없다`).toBeDefined();
      expect(value, key).toBe(LEGACY_ROOT[key]);
    }
  });

  it('화면 테마가 옛 값에서 바꾼 토큰은 전부 가드가 되돌린다 — 화면 미리보기와 인쇄 둘 다', () => {
    const changed = Object.keys(LEGACY_ROOT).filter((key) => root[key] !== undefined && root[key] !== LEGACY_ROOT[key]);
    expect(changed.length).toBeGreaterThan(0);
    for (const key of changed) {
      expect(screenGuard[key], `${key} 가 화면 가드에 없다`).toBe(LEGACY_ROOT[key]);
      expect(printGuard[key], `${key} 가 인쇄 가드에 없다`).toBe(LEGACY_ROOT[key]);
    }
  });

  it('인쇄 가드도 회색 계조 전부를 Tailwind 기본값으로 되돌린다', () => {
    for (const step of ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']) {
      const key = `--color-gray-${step}`;
      const original = tailwindTheme.match(new RegExp(`${key}:\\s*([^;]+);`))?.[1].trim();
      expect(printGuard[key], key).toBe(original);
    }
  });

  it('시트가 물려받는 글자색·글꼴은 화면 테마가 바꾸지 않는다', () => {
    expect(root['--foreground']).toBe(LEGACY_ROOT['--foreground']);
    expect(globals).toContain('--font-sans: "Pretendard Variable", Pretendard, "Nanum Barun Gothic YetHangul"');
  });

  it('화면 테마의 회색 계조는 값을 직접 적는다 — inline·var() 면 범위 되돌리기가 안 된다', () => {
    const block = declarationsAfter(globals, '@theme {');
    for (const step of ['50', '200', '500', '900']) {
      expect(block[`--color-gray-${step}`]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('globals.css 가 가드를 불러온다', () => {
    expect(globals).toContain('@import "../styles/theme/print-guard.css";');
  });
});
