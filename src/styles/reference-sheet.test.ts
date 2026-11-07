import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CALLOUT_TONES } from '@/lib/workbook-markup';
import { chromaticHexColors, printBlock } from './css-test-helpers';

const css = readFileSync(path.resolve(__dirname, 'reference-sheet.css'), 'utf8');

/** 구절 밑에 글이 찍히는 풀이 — 낱말 뜻풀이는 뺀다 */
const EXPLANATION = "span[data-note]:not([data-note-kind='vocab'])";

describe('reference-sheet.css', () => {
  it('말머리 상자의 색 갈래마다 규칙이 하나씩 있다(workbook-markup.ts 와 짝)', () => {
    for (const tone of CALLOUT_TONES) expect(css).toContain(`blockquote[data-tone='${tone}']`);
  });

  it('인쇄는 회색 한 벌이다 — 흑백 인쇄에서 색 차이로만 가르지 않는다', () => {
    const block = printBlock(css);
    expect(block.match(/#[0-9a-f]{3,6}\b/gi)?.length ?? 0).toBeGreaterThan(0);
    expect(chromaticHexColors(block)).toEqual([]);
  });

  it('작품 명조 규칙은 옛한글 작품을 건드리지 않는다 — 나눔 옛한글 글꼴을 덮으면 자모가 깨진다', () => {
    for (const line of css.split('\n').filter((l) => l.includes('ref-sheet--work') && l.includes('Noto Serif KR'))) {
      expect(line).toContain(':not(.yet-hangul-serif)');
    }
    expect(css).toContain('.ref-sheet--work:not(.yet-hangul-serif) > p');
  });

  it('구절 풀이가 든 글은 행간을 미리 벌린다 — 풀이가 흐름 밖이라 안 벌리면 다음 줄 글자를 덮는다', () => {
    expect(css).toMatch(/--ref-note-leading: [\d.]+em;/);
    const rule = css.slice(css.indexOf(`.pb-sheet.ref-sheet--work:has(${EXPLANATION}) > p`));
    expect(rule.slice(0, rule.indexOf('}'))).toContain('line-height: var(--ref-note-leading)');
    expect(rule.slice(0, rule.indexOf('}'))).toContain(`.pb-sheet.ref-sheet :is(p, li, td, th):has(${EXPLANATION})`);
  });

  it('⚠️ 낱말 뜻풀이는 행간을 벌리지 않는다 — ★ 만 찍혀 자리가 필요 없다', () => {
    expect(css).not.toContain(':has(span[data-note])');
  });

  it('인쇄 규칙과 재는 동안의 흉내가 같은 치수를 읽는다', () => {
    expect(printBlock(css)).toContain('.pb-sheet.ref-sheet { font-size: var(--ref-print-font); line-height: var(--ref-print-lh);');
    const metrics = css.slice(css.indexOf('.pb-sheet.ref-sheet.ref-sheet--print-metrics {'));
    const rule = metrics.slice(0, metrics.indexOf('}'));
    expect(rule).toContain('font-size: var(--ref-print-font)');
    expect(rule).toContain('line-height: var(--ref-print-lh)');
  });

  it('⚠️ 흉내의 폭은 보기 화면의 쪽 여백과 짝이다 — A4 210mm 에서 좌우 16mm 를 뺀다', () => {
    const view = readFileSync(path.resolve(__dirname, '../components/reference-texts/ReferenceTextView.tsx'), 'utf8');
    expect(view).toContain('margin: 14mm 16mm');
    expect(css).toContain('width: 178mm;');
  });

  it('⚠️ 흉내는 좁은 화면에서도 여백 해설을 두 칸으로 되살린다 — 인쇄는 그 미디어 쿼리에 안 걸린다', () => {
    const template = css.match(/grid-template-columns: (minmax\(0, 1fr\) minmax\(8em, 38%\));/)?.[1];
    expect(template).toBeTruthy();
    expect(css).toContain(`.ref-sheet--print-metrics table[data-layout='gloss'] { grid-template-columns: ${template} !important; }`);
    expect(css.indexOf('.ref-sheet--print-metrics table')).toBeGreaterThan(css.indexOf('@media (max-width: 640px)'));
  });

  it('보기 화면과 원장 편집기가 한 벌의 선택자를 쓴다', () => {
    expect(css).toContain(':is(.ref-sheet, .pb-editor.pb-editor--reference .ProseMirror) blockquote[data-callout]::before');
  });
});
