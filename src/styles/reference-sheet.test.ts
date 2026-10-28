import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CALLOUT_TONES } from '@/lib/workbook-markup';

const css = readFileSync(path.resolve(__dirname, 'reference-sheet.css'), 'utf8');

/** `@media print { … }` 블록 하나를 괄호 짝으로 떼어 낸다 */
function printBlock(text: string): string {
  const start = text.indexOf('@media print');
  expect(start).toBeGreaterThan(-1);
  let depth = 0;
  for (let i = text.indexOf('{', start); i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    if (text[i] === '}') depth -= 1;
    if (depth === 0) return text.slice(start, i + 1);
  }
  return text.slice(start);
}

describe('reference-sheet.css', () => {
  it('말머리 상자의 색 갈래마다 규칙이 하나씩 있다(workbook-markup.ts 와 짝)', () => {
    for (const tone of CALLOUT_TONES) expect(css).toContain(`blockquote[data-tone='${tone}']`);
  });

  it('인쇄는 회색 한 벌이다 — 흑백 인쇄에서 색 차이로만 가르지 않는다', () => {
    const colors = printBlock(css).match(/#[0-9a-f]{3,6}\b/gi) ?? [];
    expect(colors.length).toBeGreaterThan(0);
    for (const hex of colors) {
      const h = hex.slice(1);
      const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
      const [r, g, b] = [0, 2, 4].map((i) => full.slice(i, i + 2).toLowerCase());
      expect(r === g && g === b, `${hex} 는 무채색이 아니다`).toBe(true);
    }
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
