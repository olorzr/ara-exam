import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SHAPE_GLYPHS, SHAPE_KINDS } from '@/lib/workbook-markup';
import { chromaticHexColors, printBlock } from './css-test-helpers';

const css = readFileSync(path.resolve(__dirname, 'reference-phrase-marks.css'), 'utf8');
const VIEW = '.pb-sheet.ref-sheet';
const EDITOR = '.pb-editor.pb-editor--reference .ProseMirror';
const VOCAB = "span[data-note][data-note-kind='vocab']";

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

  it('풀이 글자는 청록이고 밑줄은 시트 전체가 한 색이다', () => {
    expect(rules.slice(0, rules.indexOf('}'))).toContain('color: var(--ref-note-color, #0e7490)');
    expect(ruleOf(VIEW)).toContain('--ref-note-color:');
    expect(ruleOf(VIEW)).toContain('--ref-note-line:');
    expect(ruleOf(VIEW)).toContain('--ref-star-color:');
    expect(ruleOf(`:is(.ref-sheet, ${EDITOR}) u`)).toContain('text-decoration-color: var(--ref-note-line');
  });

  it('⚠️ span 밑줄은 `<u>` 없는 풀이만이다 — 안쪽 `<u>` 가 덧그려 색이 안 보이고, 낱말 뜻풀이는 밑줄이 없다', () => {
    const line = ruleOf(`${VIEW} span[data-note]:not([data-note-kind='vocab']):not(:has(u))`);
    expect(line).toContain('text-decoration: underline');
    expect(line).toContain('text-decoration-color: var(--ref-note-line)');
    expect(ruleOf(`${VIEW} ${VOCAB}:not(.ref-vocab-in-line) u`)).toContain('text-decoration: none');
  });

  it('⚠️ 밑줄은 공백을 지킨다 — 크롬은 공백만 든 `<u> </u>` 에 줄을 안 그려 긴 밑줄이 끊긴다', () => {
    expect(ruleOf(`${VIEW} u`)).toContain('white-space: pre-wrap');
  });

  it('⚠️ 긴 밑줄 안의 낱말은 별 밑까지 줄이 이어진다 — 별이 아니라 span 에 건다', () => {
    const line = ruleOf(`${VIEW} ${VOCAB}.ref-vocab-in-line`);
    expect(line).toContain('text-decoration: underline');
    expect(line).toContain('text-decoration-color: var(--ref-note-line)');
  });

  it('네모 · 표식의 선도 밑줄과 같은 색이다 — 위 표식 규칙 뒤에 둔다', () => {
    expect(ruleOf(`${VIEW} code`)).toContain('border-color: var(--ref-note-line)');
    const frame = `:is(.ref-sheet, ${EDITOR}) span:is([data-shape='box'], [data-shape='circle'])`;
    expect(ruleOf(frame)).toContain('border-color: var(--ref-note-line');
    expect(rules.indexOf(frame)).toBeGreaterThan(rules.indexOf(`:is(.ref-sheet, ${EDITOR}) span[data-shape='circle'] {`));
    const dotted = `:is(.ref-sheet, ${EDITOR}) span:is([data-shape='triangle'], [data-shape='diamond'], [data-shape='star']) {`;
    const last = rules.slice(rules.lastIndexOf(dotted));
    expect(last.slice(0, last.indexOf('}'))).toContain('text-decoration-color: var(--ref-note-line');
  });

  it('⚠️ 첫 조각이 아닌 줄의 받침은 빈 요소다 — 위 풀이는 위로 늘린다', () => {
    expect(ruleOf(`${VIEW} .ref-note-strut`)).toContain('vertical-align: calc(var(--note-strut, 0px) / -2)');
    expect(ruleOf(`${VIEW} .ref-note-strut[data-over]`)).toContain('vertical-align: calc(var(--note-strut, 0px) / 2)');
  });

  it('⚠️ 낱말 뜻풀이의 ✦ 는 흐름 안이고 줄 높이를 안 키운다 — 위쪽 절대 배치 규칙 뒤에 온다', () => {
    const star = ruleOf(`${VIEW} ${VOCAB}::after`);
    expect(star).toContain("content: '\\2060✦'");
    expect(star).toContain('color: var(--ref-star-color)');
    expect(star).toContain('position: static');
    expect(star).toContain('line-height: 0');
    expect(star).toContain('vertical-align:');
    expect(rules.indexOf(`${VIEW} ${VOCAB}::after`)).toBeGreaterThan(rules.indexOf(`${VIEW} span[data-note]:not([data-note-pos='over'])::after`));
  });

  it('⚠️ 어휘 목록은 `:is()` 목록 규칙을 이기는 접두를 쓴다 — 줄이면 번호와 들여쓰기가 샌다', () => {
    const list = ruleOf(`${VIEW} .ref-vocab ol.ref-vocab__list`);
    expect(list).toContain('list-style: none');
    expect(list).toContain('padding: 0');
    expect(list).toContain('columns: 2');
    expect(rules).toContain(`${VIEW}:not(.yet-hangul, .yet-hangul-serif) .ref-vocab { font-family: var(--font-sans); }`);
  });

  it('편집기는 낱말 뜻풀이를 해설과 구별해 보여 준다', () => {
    expect(rules).toContain(`${EDITOR} ${VOCAB}:not([data-note-pos='over'])::after`);
    expect(rules).toContain(`${EDITOR} ${VOCAB}[data-note-pos='over']::before`);
    expect(rules).toContain("content: '✦ ' attr(data-note)");
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
    expect(block).toContain(`:is(${VIEW}, ${EDITOR}) {`);
    expect(block).toContain('--ref-note-color: #444');
    expect(block).toContain('--ref-note-line: #444');
    expect(block).toContain('--ref-star-color: #444');
    expect(block).toContain('background: none');
    expect(chromaticHexColors(block)).toEqual([]);
  });
});
