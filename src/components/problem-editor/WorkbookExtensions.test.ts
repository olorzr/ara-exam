import { describe, expect, it } from 'vitest';
import { Editor, type AnyExtension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Table, TableRow } from '@tiptap/extension-table';
import { CustomTableCell, CustomTableHeader } from '@/components/exam-builder/CustomTableCell';
import { sanitizeReferenceHTML } from '@/lib/sanitize-reference';
import { VerseTableAttribute } from './VerseTableAttribute';
import { ReferenceTableLayoutAttribute, WORKBOOK_EXTENSIONS, pastePlainText } from './WorkbookExtensions';

/** 편집기에 넣었다가 내보낸 뒤 정화한다 — 저장 경로와 같다 */
function roundTrip(html: string, extensions: AnyExtension[]): string {
  const editor = new Editor({
    extensions: [StarterKit, Table, TableRow, CustomTableCell, CustomTableHeader, ...extensions],
    content: html,
  });
  const out = sanitizeReferenceHTML(editor.getHTML());
  editor.destroy();
  return out;
}

const REFERENCE = [...WORKBOOK_EXTENSIONS, ReferenceTableLayoutAttribute];

describe('문제집 서식 확장 — 편집기를 지나도 표시가 남는다', () => {
  it('말머리 상자(말머리·색 갈래)', () => {
    const out = roundTrip('<blockquote data-callout="학습 목표" data-tone="goal"><p>가</p></blockquote>', REFERENCE);
    expect(out).toContain('data-callout="학습 목표"');
    expect(out).toContain('data-tone="goal"');
  });

  it('형광펜·작은 글씨', () => {
    const out = roundTrip('<p><mark>특성</mark>과 화자 <small>(話 말할 화)</small></p>', REFERENCE);
    expect(out).toBe('<p><mark>특성</mark>과 화자 <small>(話 말할 화)</small></p>');
  });

  it('화살표 도식', () => {
    expect(roundTrip('<ul data-flow="down"><li><p>전</p></li><li><p>후</p></li></ul>', REFERENCE))
      .toContain('<ul data-flow="down">');
  });

  it('여백 해설·어휘 풀이·나란히 표', () => {
    for (const layout of ['gloss', 'vocab', 'verse']) {
      const html = `<table data-layout="${layout}"><tbody><tr><td><p>가</p></td><td><p>나</p></td></tr></tbody></table>`;
      expect(roundTrip(html, REFERENCE)).toContain(`data-layout="${layout}"`);
    }
  });

  it('⚠️ 확장이 없으면 표시가 사라진다 — 지우면 저장할 때마다 상자·해설이 사라진다', () => {
    const out = roundTrip('<blockquote data-callout="학습 목표"><p><mark>가</mark></p></blockquote>', []);
    expect(out).not.toContain('data-callout');
    expect(out).not.toContain('<mark');
  });

  it('문항 편집기의 표 속성은 verse 만 받는다 — 여백 해설은 걷힌다', () => {
    const html = '<table data-layout="gloss"><tbody><tr><td><p>가</p></td></tr></tbody></table>';
    expect(roundTrip(html, [VerseTableAttribute])).not.toContain('data-layout');
  });
});

describe('평문 붙여넣기 — 시의 행과 연을 지킨다', () => {
  it('빈 줄은 연(문단), 줄바꿈은 행(<br>)', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const editor = new Editor({ element, extensions: [StarterKit, ...REFERENCE], content: '<p></p>' });
    pastePlainText(editor.view, '나 보기가\n역겨워\n\n가실 때에는 <b>말없이</b>');
    expect(editor.getHTML()).toBe('<p>나 보기가<br>역겨워</p><p>가실 때에는 &lt;b&gt;말없이&lt;/b&gt;</p>');
    editor.destroy();
  });
});
