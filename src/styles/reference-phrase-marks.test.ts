import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SHAPE_GLYPHS, SHAPE_KINDS } from '@/lib/workbook-markup';
import { chromaticHexColors, printBlock } from './css-test-helpers';

const css = readFileSync(path.resolve(__dirname, 'reference-phrase-marks.css'), 'utf8');
const SCOPE = ':is(.ref-sheet, .pb-editor.pb-editor--reference .ProseMirror)';

describe('reference-phrase-marks.css', () => {
  it('풀이는 흐름 안의 인라인 블록이다 — 줄 상자가 늘어나 앞뒤 줄과 안 겹치고 칸 폭에서 꺾인다', () => {
    expect(css).toContain(`${SCOPE} span[data-note] {\n  display: inline-block;`);
    expect(css).toContain('content: attr(data-note)');
    expect(css).toContain('overflow-wrap: anywhere');
    expect(css).not.toMatch(/position:\s*absolute/);
    expect(css).not.toMatch(/white-space:\s*nowrap/);
  });

  it('⚠️ 루비로 되돌리지 않는다 — 크롬의 루비 풀이는 꺾이지 않아 옆 칸을 덮고 <br> 을 무시한다', () => {
    expect(css).not.toMatch(/display:\s*ruby/);
  });

  it('⚠️ 아래 풀이는 첫 줄이 기준선이다 — 아니면 구절이 풀이 높이만큼 떠오른다', () => {
    expect(css).toContain('baseline-source: first');
    expect(css).toContain(`${SCOPE} span[data-note][data-note-pos='over'] { baseline-source: last; }`);
  });

  it('⚠️ 줄바꿈이 든 풀이는 상자를 푼다 — 구절 뒤 글자가 둘째 행보다 앞에 찍힌다', () => {
    expect(css).toContain(`${SCOPE} span[data-note]:has(br) { display: inline; }`);
    expect(css).toContain(":has(br)::after");
    expect(css).toContain(":has(br)::before");
  });

  it('⚠️ 풀이 폭에 고정 상한이 있다 — 없으면 짧은 낱말의 상자가 풀이만큼 넓어져 본문에 구멍이 난다', () => {
    const rule = css.match(/content: attr\(data-note\);[\s\S]*?\n}/)?.[0] ?? '';
    expect(rule).toMatch(/max-width:\s*\d+(\.\d+)?em;/);
    expect(rule).toContain('margin-inline: auto;');
  });

  it('위 풀이는 구절 앞, 아래 풀이는 구절 뒤에 그린다', () => {
    expect(css).toContain("span[data-note]:not([data-note-pos='over'])::after");
    expect(css).toContain("span[data-note][data-note-pos='over']::before");
  });

  it('표식마다 규칙이 있고 앞붙임 기호는 어휘와 같다', () => {
    for (const kind of SHAPE_KINDS) expect(css).toContain(`[data-shape='${kind}']`);
    for (const [kind, glyph] of Object.entries(SHAPE_GLYPHS)) {
      expect(css).toContain(`span[data-shape='${kind}']::before { content: '${glyph}'; }`);
    }
  });

  it('인쇄는 회색 한 벌이다', () => {
    const block = printBlock(css);
    expect(block).toContain("span[data-note]:not([data-note-pos='over'])::after");
    expect(chromaticHexColors(block)).toEqual([]);
  });
});
