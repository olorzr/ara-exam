import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Table, TableRow } from '@tiptap/extension-table';
import { CustomTableCell, CustomTableHeader } from '@/components/exam-builder/CustomTableCell';
import { sanitizeProblemHTML } from '@/lib/sanitize-problem';
import { VerseTableAttribute, VerseTableView } from './VerseTableAttribute';

/** 검수 편집기와 같은 표 확장 셋으로 한 번 읽고 내보낸 뒤 정화한다(저장 경로와 같다) */
function roundTrip(html: string, withVerse = true): string {
  const editor = new Editor({
    extensions: [
      StarterKit,
      Table,
      ...(withVerse ? [VerseTableAttribute] : []),
      TableRow,
      CustomTableCell,
      CustomTableHeader,
    ],
    content: html,
  });
  const out = sanitizeProblemHTML(editor.getHTML());
  editor.destroy();
  return out;
}

const VERSE = '<table data-layout="verse"><tbody><tr><td><p>生死路隱</p></td><td><p>생사 길은</p></td></tr></tbody></table>';

describe('VerseTableAttribute', () => {
  it('편집기를 지나도 칸선 없는 나란히 표 표시가 남는다', () => {
    expect(roundTrip(VERSE)).toContain('data-layout="verse"');
  });

  it('⚠️ 이 확장이 없으면 표시가 사라진다 — 지우면 저장할 때마다 칸선이 되살아난다', () => {
    expect(roundTrip(VERSE, false)).not.toContain('data-layout');
  });

  it('보통 표에는 표시를 붙이지 않는다', () => {
    expect(roundTrip('<table><tbody><tr><td><p>가</p></td></tr></tbody></table>')).not.toContain('data-layout');
  });
});

describe('VerseTableView (크기 조절 표)', () => {
  /** 검수 편집기와 같은 설정 — resizable 이면 NodeView 가 <table> 을 직접 그린다 */
  function liveEditor(html: string) {
    const element = document.createElement('div');
    document.body.appendChild(element);
    return new Editor({
      element,
      extensions: [
        StarterKit,
        Table.configure({ resizable: true, View: VerseTableView }),
        VerseTableAttribute,
        TableRow,
        CustomTableCell,
        CustomTableHeader,
      ],
      content: html,
    });
  }

  it('편집기 화면의 표에도 data-layout 이 붙는다 — 그래야 점선 칸으로 보인다', () => {
    const editor = liveEditor(VERSE);
    expect(editor.view.dom.querySelector('table')?.getAttribute('data-layout')).toBe('verse');
    editor.destroy();
  });

  it('단추로 켜고 끄면 화면의 표도 따라 바뀐다', () => {
    const editor = liveEditor('<table><tbody><tr><td><p>가</p></td><td><p>나</p></td></tr></tbody></table>');
    const table = () => editor.view.dom.querySelector('table');
    expect(table()?.hasAttribute('data-layout')).toBe(false);
    editor.chain().setTextSelection(3).updateAttributes('table', { layout: 'verse' }).run();
    expect(table()?.getAttribute('data-layout')).toBe('verse');
    expect(editor.getHTML()).toContain('data-layout="verse"');
    editor.chain().setTextSelection(3).updateAttributes('table', { layout: null }).run();
    expect(table()?.hasAttribute('data-layout')).toBe(false);
    editor.destroy();
  });
});
