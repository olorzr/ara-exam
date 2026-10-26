import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SPINE_FONT, isSpineFontId, SPINE_BRAND_FONT_SPEC, SPINE_FONT_GROUPS, SPINE_FONT_IDS, SPINE_FONTS,
  spineFontFamily, spineFontOf, spineFontSpec,
} from './spine-fonts';

const globals = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
const noonnuCss = readFileSync(join(process.cwd(), 'src/styles/book-fonts.css'), 'utf8');

/** book-fonts.css 의 @font-face 들 — 패밀리 → 굵기 */
const noonnuFaces = new Map(
  [...noonnuCss.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => [
    /font-family:\s*'([^']+)'/.exec(m[1])?.[1] ?? '',
    Number(/font-weight:\s*(\d+)/.exec(m[1])?.[1] ?? NaN),
  ]),
);

/** @fontsource 패키지 이름 — 패밀리 이름을 소문자·하이픈으로 */
const fontsourceSlug = (family: string) => family.toLowerCase().replace(/\s+/g, '-');

describe('책등 제목 글꼴 목록', () => {
  it('목록과 이름표가 1:1, 기본은 지마켓 산스(0.9.58 까지 쓰던 글꼴)', () => {
    expect(SPINE_FONTS.map((f) => f.id)).toEqual([...SPINE_FONT_IDS]);
    expect(new Set(SPINE_FONTS.map((f) => f.family)).size).toBe(SPINE_FONTS.length);
    for (const f of SPINE_FONTS) {
      expect(SPINE_FONT_GROUPS).toContain(f.group);
      expect(f.sizeScale).toBeGreaterThanOrEqual(1);
      expect(f.sizeScale).toBeLessThanOrEqual(1.5);
    }
    expect(new Set(SPINE_FONTS.map((f) => f.label)).size).toBe(SPINE_FONTS.length);
    expect(DEFAULT_SPINE_FONT).toBe('gmarket');
    expect(spineFontOf(DEFAULT_SPINE_FONT).family).toBe('Gmarket Sans');
  });

  it('모르는 이름표는 기본 글꼴', () => {
    expect(isSpineFontId('jua')).toBe(true);
    expect(isSpineFontId('comic-sans')).toBe(false);
    expect(isSpineFontId(3)).toBe(false);
    expect(spineFontOf('comic-sans').id).toBe(DEFAULT_SPINE_FONT);
  });

  it('그릴 때는 대체 글꼴을 붙이고, 미리 받기 지정은 굵기 + 패밀리', () => {
    const jua = spineFontOf('jua');
    expect(spineFontFamily(jua)).toBe('"Jua", "Pretendard Variable", Pretendard, sans-serif');
    expect(spineFontSpec(jua)).toBe('400 1em "Jua"');
    expect(spineFontSpec(spineFontOf('gmarket'))).toBe(SPINE_BRAND_FONT_SPEC);
  });

  it('눈누 글꼴은 book-fonts.css 에 그 이름·굵기의 @font-face 가 있고, 쓰지 않는 선언이 없다', () => {
    const noonnu = SPINE_FONTS.filter((f) => f.source === 'noonnu');
    for (const font of noonnu) expect(noonnuFaces.get(font.family), font.label).toBe(font.weight);
    expect([...noonnuFaces.keys()].sort()).toEqual(noonnu.map((f) => f.family).sort());
    // CSP font-src 가 여는 CDN 만 — 다른 주소면 운영에서 조용히 막힌다
    for (const m of noonnuCss.matchAll(/url\('([^']+)'\)/g)) expect(m[1].startsWith('https://cdn.jsdelivr.net/gh/')).toBe(true);
    expect(globals).toContain('@import "../styles/book-fonts.css";');
  });

  it('globals.css 가 구글·앱 글꼴을 그 굵기로 가져온다 — 한쪽만 고치면 대체 글꼴로 찍힌다', () => {
    for (const font of SPINE_FONTS.filter((f) => f.source !== 'noonnu')) {
      if (font.family === 'Gmarket Sans') {
        expect(globals).toContain('gmarket-sans-dynamic-subset/GmarketSans.css');
        continue;
      }
      if (font.family === 'Pretendard Variable') {
        expect(globals).toContain('pretendardvariable-dynamic-subset');
        continue;
      }
      const pattern = new RegExp(`@fontsource/${fontsourceSlug(font.family)}@\\d+\\.\\d+\\.\\d+/${font.weight}\\.css`);
      expect(globals, font.label).toMatch(pattern);
    }
  });
});
