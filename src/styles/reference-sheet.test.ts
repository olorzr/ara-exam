import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CALLOUT_TONES } from '@/lib/workbook-markup';
import { chromaticHexColors, printBlock } from './css-test-helpers';

const css = readFileSync(path.resolve(__dirname, 'reference-sheet.css'), 'utf8');

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

  it('보기 화면과 원장 편집기가 한 벌의 선택자를 쓴다', () => {
    expect(css).toContain(':is(.ref-sheet, .pb-editor.pb-editor--reference .ProseMirror) blockquote[data-callout]::before');
  });
});
