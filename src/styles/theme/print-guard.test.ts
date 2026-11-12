import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const guard = readFileSync(path.resolve(__dirname, 'print-guard.css'), 'utf8');
const globals = readFileSync(path.resolve(__dirname, '../../app/globals.css'), 'utf8');
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

const screenGuard = declarationsAfter(guard, ':where(.a4-sheet');
const printGuard = declarationsAfter(guard, 'html:root');
const root = declarationsAfter(globals.slice(globals.indexOf('\n:root {')), ':root {');

describe('인쇄 가드(print-guard.css)', () => {
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

  it('화면 테마가 옛 값에서 바꾼 토큰은 전부 가드가 되돌린다', () => {
    const changed = Object.keys(LEGACY_ROOT).filter((key) => root[key] !== undefined && root[key] !== LEGACY_ROOT[key]);
    expect(changed.length).toBeGreaterThan(0);
    for (const key of changed) expect(screenGuard[key], `${key} 가 가드에 없다`).toBe(LEGACY_ROOT[key]);
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
