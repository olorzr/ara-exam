import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SPINE_FONT, isSpineFontId, SPINE_BRAND_FONT_SPEC, SPINE_FONT_IDS, SPINE_FONTS, spineFontFamily, spineFontOf,
  spineFontSpec,
} from './spine-fonts';

const globals = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');

/** @fontsource 패키지 이름 — 패밀리 이름을 소문자·하이픈으로 */
const fontsourceSlug = (family: string) => family.toLowerCase().replace(/\s+/g, '-');

describe('책등 제목 글꼴 목록', () => {
  it('목록과 이름표가 1:1, 기본은 지마켓 산스(0.9.58 까지 쓰던 글꼴)', () => {
    expect(SPINE_FONTS.map((f) => f.id)).toEqual([...SPINE_FONT_IDS]);
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

  it('globals.css 가 목록의 글꼴을 그 굵기로 가져온다 — 한쪽만 고치면 대체 글꼴로 찍힌다', () => {
    for (const font of SPINE_FONTS) {
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
