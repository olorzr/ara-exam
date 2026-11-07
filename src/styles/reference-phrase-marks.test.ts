import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SHAPE_GLYPHS, SHAPE_KINDS } from '@/lib/workbook-markup';
import { chromaticHexColors, printBlock } from './css-test-helpers';

const css = readFileSync(path.resolve(__dirname, 'reference-phrase-marks.css'), 'utf8');
const VIEW = '.pb-sheet.ref-sheet';
const EDITOR = '.pb-editor.pb-editor--reference .ProseMirror';

/** 주석을 뺀 선언 — 주석 속 낱말로 규칙이 있는 체하지 않게 한다 */
const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
/** 선택자가 정확히 이것인 규칙의 본문 */
function ruleOf(selector: string): string {
  const start = rules.indexOf(`${selector} {`);
  return start < 0 ? '' : rules.slice(start, rules.indexOf('}', start));
}

describe('reference-phrase-marks.css', () => {
  it('보기 화면 — 본문은 줄글이고 풀이는 구절에 붙어 한 줄로 흐른다', () => {
    expect(ruleOf(`${VIEW} span[data-note]`)).toContain('position: relative');
    expect(ruleOf(`${VIEW} span[data-note]`)).not.toContain('inline-block');
    const note = ruleOf(`${VIEW} span[data-note]::after`);
    expect(note).toContain('position: absolute');
    expect(note).toContain('white-space: nowrap');
    expect(note).toContain('left: var(--note-dx, 0px)');
  });

  it('보기 화면 — 풀이 자리는 배치 스크립트의 값을 읽고, 없으면 구절 바로 밑·위다', () => {
    expect(ruleOf(`${VIEW} span[data-note]:not([data-note-pos='over'])::after`)).toContain('top: calc(var(--note-dy, 100%) + var(--note-shift, 0px))');
    expect(ruleOf(`${VIEW} span[data-note][data-note-pos='over']::after`)).toContain('bottom: calc(100% + var(--note-shift, 0px))');
    const wrap = ruleOf(`${VIEW} span[data-note][data-note-fit='wrap']::after`);
    expect(wrap).toContain('width: var(--note-w)');
    expect(wrap).toContain('white-space: normal');
  });

  it('⚠️ 받침은 `::before` 의 빈 인라인 상자다 — 꺾인 구절의 첫 조각에 붙고 줄바꿈 기회를 만들지 않는다', () => {
    const strut = ruleOf(`${VIEW} span[data-note]::before`);
    expect(strut).toContain("content: ''");
    expect(strut).toContain('line-height: var(--note-strut, 0px)');
    expect(strut).toContain('vertical-align: calc(var(--note-strut, 0px) / -2)');
    expect(strut).not.toContain('inline-block');
    expect(ruleOf(`${VIEW} span[data-note][data-note-pos='over']::before`)).toContain('vertical-align: calc(var(--note-strut, 0px) / 2)');
  });

  it('편집기 — 구절과 풀이를 위아래로 쌓은 상자 그대로다', () => {
    const box = ruleOf(`${EDITOR} span[data-note]`);
    expect(box).toContain('display: inline-block');
    expect(box).toContain('baseline-source: first');
    expect(ruleOf(`${EDITOR} span[data-note][data-note-pos='over']`)).toContain('baseline-source: last');
    expect(rules).toContain(`${EDITOR} span[data-note]:not([data-note-pos='over'])::after`);
    expect(rules).toContain(`${EDITOR} span[data-note][data-note-pos='over']::before`);
    expect(rules).toMatch(/max-width:\s*\d+(\.\d+)?em;/);
    expect(rules).toContain('margin-inline: auto;');
    expect(rules).toContain(`${EDITOR} span[data-note]:has(br) { display: inline; }`);
  });

  it('⚠️ 흐름 밖 풀이와 한 줄 고정은 보기 화면에만 있다 — 편집기는 스크립트가 안 돌아 겹침을 못 푼다', () => {
    for (const declaration of [/position:\s*absolute/, /white-space:\s*nowrap/]) {
      const blocks = rules.split('}').filter((block) => declaration.test(block));
      expect(blocks.length).toBeGreaterThan(0);
      for (const block of blocks) expect(block).not.toContain('ProseMirror');
    }
  });

  it('풀이 글자 모양은 보기·편집기가 한 벌이고, 자리 선언이 섞이지 않는다', () => {
    const shared = rules.slice(rules.indexOf('.ref-sheet span[data-note]::after'), rules.indexOf('}'));
    expect(shared).toContain('content: attr(data-note)');
    expect(shared).toContain('font-size: 0.72em');
    expect(shared).not.toMatch(/position|display|max-width|margin/);
  });

  it('⚠️ 루비로 되돌리지 않는다 — 크롬의 루비 풀이는 꺾이지 않아 옆 칸을 덮고 <br> 을 무시한다', () => {
    expect(rules).not.toMatch(/display:\s*ruby/);
  });

  it('표식마다 규칙이 있고 앞붙임 기호는 어휘와 같다', () => {
    for (const kind of SHAPE_KINDS) expect(css).toContain(`[data-shape='${kind}']`);
    for (const [kind, glyph] of Object.entries(SHAPE_GLYPHS)) {
      expect(css).toContain(`span[data-shape='${kind}']::before { content: '${glyph}'; }`);
    }
  });

  it('인쇄는 회색 한 벌이다', () => {
    const block = printBlock(css);
    expect(block).toContain('.ref-sheet span[data-note]::after');
    expect(block).toContain(`${EDITOR} span[data-note][data-note-pos='over']::before`);
    expect(chromaticHexColors(block)).toEqual([]);
  });
});
