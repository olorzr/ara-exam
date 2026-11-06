import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { REFERENCE_STARTER_KIT, WORKBOOK_EXTENSIONS, pastePlainText } from './WorkbookExtensions';

/** 풀이 · 표식 · 네모 · 줄바꿈이 다 든 본문 */
const BODY = '<p>앞 <span data-note="뜻"><span data-shape="star">표식</span> 구절</span><br><span data-note="뜻">다음 줄</span> <code>네모</code></p><p>둘째 <u>문단</u></p>';

/** 편집 횟수 */
const ROUNDS = 600;

/**
 * 시드로 정해진 편집을 이어 한다.
 * @param start - 시드
 * @param rounds - 편집 횟수
 * @returns 끝난 뒤의 본문
 */
function randomEdits(start: number, rounds: number): string {
  let seed = start;
  const next = (limit: number) => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed % limit;
  };
  const editor = new Editor({ extensions: [StarterKit.configure(REFERENCE_STARTER_KIT), ...WORKBOOK_EXTENSIONS], content: BODY });
  const paste = (html: string) => editor.view.pasteHTML(html, new Event('paste') as ClipboardEvent);
  const edits = [
    () => editor.view.dispatch(editor.state.tr.insertText('가')),
    () => editor.commands.setHardBreak(),
    () => editor.commands.keyboardShortcut('Enter'),
    () => editor.commands.deleteSelection(),
    () => editor.commands.toggleBold(),
    () => editor.commands.setHorizontalRule(),
    () => editor.commands.undo(),
    () => editor.commands.redo(),
    () => paste('<p>X</p><p>Y</p>'),
    () => paste('<ul><li><p>항목</p></li><li><p>둘</p></li></ul>'),
    () => paste('<span data-note="뜻">복사</span>'),
    () => pastePlainText(editor.view, '행\n둘째 행'),
  ];
  for (let round = 0; round < rounds; round += 1) {
    const size = Math.max(editor.state.doc.content.size - 1, 1);
    const a = 1 + next(size);
    const b = 1 + next(size);
    editor.commands.setTextSelection({ from: Math.min(a, b), to: Math.max(a, b) });
    edits[next(edits.length)]();
  }
  const html = editor.getHTML();
  editor.destroy();
  return html;
}

describe('풀이 지키기는 모든 글쇠에서 돈다', () => {
  it('⚠️ 아무 편집을 이어 해도 터지지 않는다', () => {
    expect(randomEdits(20261106, ROUNDS).length).toBeGreaterThan(0);
  });
});
