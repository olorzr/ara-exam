import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { REFERENCE_STARTER_KIT, WORKBOOK_EXTENSIONS, pastePlainText } from './WorkbookExtensions';
import { PHRASE_NOTE_MARK } from './WorkbookMarks';

/** 참고자료 편집기와 같은 마크를 든 편집기 */
function referenceEditor(content: string): Editor {
  return new Editor({ extensions: [StarterKit.configure(REFERENCE_STARTER_KIT), ...WORKBOOK_EXTENSIONS], content });
}

/** HTML 을 붙여 넣는다 — jsdom 에는 `ClipboardEvent` 가 없어 이벤트를 직접 넘긴다 */
function pasteHtml(editor: Editor, html: string): void {
  editor.view.pasteHTML(html, new Event('paste') as ClipboardEvent);
}

describe('풀이·표식 안에 끼는 내용 — 같은 풀이가 두 번 찍히지 않고 따로 단 풀이가 합쳐지지 않는다', () => {
  it('⚠️ 풀이 안에서 줄을 바꿔도 풀이는 하나다 — 표시 없는 줄바꿈이 끼면 같은 풀이가 두 번 찍힌다', () => {
    const editor = referenceEditor('<p><span data-note="풀이">앞뒤</span></p>');
    editor.chain().setTextSelection(2).setHardBreak().run();
    expect(editor.getHTML()).toBe('<p><span data-note="풀이">앞<br>뒤</span></p>');
    editor.destroy();
  });

  it('표식 안에서 줄을 바꿔도 표식은 하나다', () => {
    const editor = referenceEditor('<p><span data-shape="star">앞뒤</span></p>');
    editor.chain().setTextSelection(2).setHardBreak().run();
    expect(editor.getHTML()).toBe('<p><span data-shape="star">앞<br>뒤</span></p>');
    editor.destroy();
  });

  it('풀이 끝에서 줄을 바꾸면 풀이 밖이다', () => {
    const editor = referenceEditor('<p><span data-note="풀이">앞</span>뒤</p>');
    editor.chain().setTextSelection(2).setHardBreak().run();
    expect(editor.getHTML()).toBe('<p><span data-note="풀이">앞</span><br>뒤</p>');
    editor.destroy();
  });

  it('⚠️ 같은 풀이를 두 행에 따로 달아도 둘은 합쳐지지 않는다 — 이미 있던 줄바꿈은 손대지 않는다', () => {
    const editor = referenceEditor('<p>가<br>나</p>');
    editor.chain().setTextSelection({ from: 1, to: 2 }).setMark(PHRASE_NOTE_MARK, { 'data-note': '심상' }).run();
    editor.chain().setTextSelection({ from: 3, to: 4 }).setMark(PHRASE_NOTE_MARK, { 'data-note': '심상' }).run();
    const separate = '<p><span data-note="심상">가</span><br><span data-note="심상">나</span></p>';
    expect(editor.getHTML()).toBe(separate);
    editor.chain().setTextSelection(4).insertContent('다').run();
    expect(editor.getHTML()).toBe('<p><span data-note="심상">가</span><br><span data-note="심상">나</span>다</p>');
    editor.destroy();
  });

  it('같은 뜻의 해설과 낱말 뜻풀이는 사이에 넣은 글자가 어느 쪽도 안 입는다', () => {
    const editor = referenceEditor('<p><span data-note="뜻">가</span><span data-note="뜻" data-note-kind="vocab">나</span></p>');
    editor.chain().setTextSelection(2).insertContent('<br>').run();
    expect(editor.getHTML()).toBe('<p><span data-note="뜻">가</span><br><span data-note="뜻" data-note-kind="vocab">나</span></p>');
    editor.destroy();
  });

  it('⚠️ 따로 단 두 풀이는 굵게 · 다시 불러오기 · 붙여넣기 · 되돌리기를 지나도 합쳐지지 않는다', () => {
    const separate = '<p><span data-note="심상">가</span><br><span data-note="심상">나</span></p>';
    const notes = (html: string) => html.match(/data-note=/g)?.length ?? 0;

    const bold = referenceEditor(separate);
    bold.chain().setTextSelection({ from: 1, to: 4 }).toggleBold().run();
    expect(notes(bold.getHTML())).toBe(2);
    bold.destroy();

    const reload = referenceEditor('<p></p>');
    reload.commands.setContent(separate);
    expect(reload.getHTML()).toBe(separate);
    reload.destroy();

    const pasted = referenceEditor('<p></p>');
    pasteHtml(pasted, separate);
    expect(notes(pasted.getHTML())).toBe(2);
    pasted.destroy();

    const undo = referenceEditor(separate);
    undo.chain().setTextSelection({ from: 2, to: 3 }).deleteSelection().run();
    expect(notes(undo.getHTML())).toBe(1);
    undo.commands.undo();
    expect(undo.getHTML()).toBe(separate);
    undo.destroy();
  });

  it('⚠️ 구절 뒷부분을 줄바꿈으로 바꾸면 이어 친 글자는 풀이 밖이다 — 같은 풀이가 두 번 찍힌다', () => {
    for (const [open, close] of [['<span data-note="풀이">', '</span>'], ['<span data-shape="star">', '</span>']]) {
      const editor = referenceEditor(`<p>${open}앞뒤${close}</p>`);
      editor.chain().setTextSelection({ from: 2, to: 3 }).setHardBreak().run();
      editor.view.dispatch(editor.state.tr.insertText('글'));
      expect(editor.getHTML()).toBe(`<p>${open}앞${close}<br>글</p>`);
      editor.destroy();
    }
  });

  it('⚠️ 풀이 사이의 맨 줄바꿈을 줄바꿈으로 갈아 끼워도 두 풀이는 그대로다', () => {
    const separate = '<p><span data-note="심상">가</span><br><span data-note="심상">나</span></p>';
    const editor = referenceEditor(separate);
    editor.chain().setTextSelection({ from: 2, to: 3 }).setHardBreak().run();
    expect(editor.getHTML()).toBe(separate);
    editor.destroy();
  });

  it('풀이 안의 줄바꿈을 갈아 끼워도 풀이는 하나다', () => {
    const inside = '<p><span data-note="풀이">앞<br>뒤</span></p>';
    const editor = referenceEditor(inside);
    editor.chain().setTextSelection({ from: 2, to: 3 }).setHardBreak().run();
    expect(editor.getHTML()).toBe(inside);
    editor.destroy();
  });

  const notes = (editor: Editor) => editor.getHTML().match(/data-note=/g)?.length ?? 0;

  it('⚠️ 풀이 안쪽에서 문단을 나누면 풀이는 앞 문단에 남는다 — 두 문단에 같은 풀이가 찍히면 고칠 때 한쪽만 바뀐다', () => {
    const editor = referenceEditor('<p><span data-note="뜻">가나</span></p>');
    editor.commands.setTextSelection(2);
    editor.commands.keyboardShortcut('Enter');
    expect(editor.getHTML()).toBe('<p><span data-note="뜻">가</span></p><p>나</p>');
    editor.destroy();
  });

  it('⚠️ 구분선 · 문단 붙여넣기로 풀이가 갈려도 풀이는 하나다', () => {
    const rule = referenceEditor('<p><span data-note="뜻">abcd</span></p>');
    rule.chain().setTextSelection(3).setHorizontalRule().run();
    expect(notes(rule)).toBe(1);
    rule.destroy();

    const pasted = referenceEditor('<p><span data-note="뜻">abcd</span></p>');
    pasted.commands.setTextSelection(3);
    pasteHtml(pasted, '<p>X</p><p>Y</p>');
    expect(notes(pasted)).toBe(1);
    pasted.destroy();
  });

  it('⚠️ 목록을 풀이 안에 붙여 넣어도 풀이는 하나다 — 다른 종류의 교체 단계로 들어온다', () => {
    const editor = referenceEditor('<p><span data-note="뜻">abcd</span></p>');
    editor.commands.setTextSelection(3);
    pasteHtml(editor, '<ul><li><p>X</p></li><li><p>Y</p></li></ul>');
    expect(notes(editor)).toBe(1);
    expect(editor.getHTML()).toContain('cd');
    editor.destroy();
  });

  it('⚠️ 붙여 넣은 글의 풀이는 뒷조각을 걷을 때 함께 안 걷힌다', () => {
    const editor = referenceEditor('<p><span data-note="뜻">abcd</span></p>');
    editor.commands.setTextSelection(3);
    pasteHtml(editor, '<p>X</p><p><span data-note="뜻">Y</span></p>');
    expect(editor.getHTML()).toContain('<span data-note="뜻">Y</span>cd');
    editor.destroy();
  });

  it('⚠️ 따로 단 두 풀이의 경계를 지워도 뒤 풀이는 안 걷힌다 — 양끝 표시가 같아도 한 덩이가 아니다', () => {
    const lines = referenceEditor('<p><span data-note="심상">가</span><br><span data-note="심상">나</span></p>');
    lines.commands.setTextSelection({ from: 2, to: 3 });
    lines.commands.keyboardShortcut('Enter');
    expect(notes(lines)).toBe(2);
    lines.destroy();

    const blocks = referenceEditor('<p><span data-note="심상">가나</span></p><p><span data-note="심상">다라</span></p>');
    blocks.commands.setTextSelection({ from: 2, to: 6 });
    blocks.commands.keyboardShortcut('Enter');
    expect(notes(blocks)).toBe(2);
    blocks.destroy();
  });

  it('문단을 나눈 뒤 이어 친 글자는 풀이 밖이고 서식은 남는다', () => {
    const editor = referenceEditor('<p><span data-note="뜻"><strong>가나</strong></span></p>');
    editor.commands.setTextSelection(2);
    editor.commands.keyboardShortcut('Enter');
    editor.view.dispatch(editor.state.tr.insertText('글'));
    expect(editor.getHTML()).toBe('<p><span data-note="뜻"><strong>가</strong></span></p><p><strong>글나</strong></p>');
    editor.destroy();
  });

  it('풀이 끝의 Enter 는 그대로 문단을 나눈다', () => {
    const editor = referenceEditor('<p><span data-note="뜻">가나</span>다</p>');
    editor.commands.setTextSelection(3);
    editor.commands.keyboardShortcut('Enter');
    expect(editor.getHTML()).toBe('<p><span data-note="뜻">가나</span></p><p>다</p>');
    editor.destroy();
  });

  it('⚠️ 경계 줄바꿈까지 고른 범위를 바꿔도 이어 친 글자는 풀이 밖이다', () => {
    const editor = referenceEditor('<p><span data-note="뜻">앞뒤</span><br>다음</p>');
    editor.chain().setTextSelection({ from: 2, to: 4 }).setHardBreak().run();
    editor.view.dispatch(editor.state.tr.insertText('글'));
    expect(editor.getHTML()).toBe('<p><span data-note="뜻">앞</span><br>글다음</p>');
    editor.destroy();
  });

  it('⚠️ 풀이 안 두 표식 사이의 줄바꿈을 갈아 끼워도 표식은 둘이다 — 경계는 표시마다 따로 본다', () => {
    const html = '<p><span data-note="뜻"><span data-shape="star">가</span><br><span data-shape="star">나</span></span></p>';
    const editor = referenceEditor(html);
    editor.chain().setTextSelection({ from: 2, to: 3 }).setHardBreak().run();
    expect(editor.getHTML()).toBe(html);
    editor.destroy();
  });

  it('⚠️ 풀이 안 줄바꿈 앞의 줄바꿈은 바로 옆 줄바꿈의 표시를 본다', () => {
    const editor = referenceEditor('<p><span data-note="A">ab<br></span>cd</p>');
    editor.chain().setTextSelection(3).setHardBreak().run();
    expect(editor.getHTML()).toBe('<p><span data-note="A">ab<br><br></span>cd</p>');
    editor.destroy();
  });

  it('⚠️ 여러 줄 평문을 풀이 안에 붙여 넣어도 풀이는 하나다', () => {
    const editor = referenceEditor('<p><span data-note="뜻">abcd</span></p>');
    editor.commands.setTextSelection(3);
    pastePlainText(editor.view, 'X\nY');
    expect(editor.getHTML()).toBe('<p><span data-note="뜻">abX<br>Ycd</span></p>');
    editor.destroy();
  });

  it('서식 있는 글자를 풀이 안에 붙여 넣어도 풀이는 하나다', () => {
    const editor = referenceEditor('<p><span data-note="뜻">abcd</span></p>');
    editor.commands.setTextSelection(3);
    pasteHtml(editor, '<strong>굵은</strong>');
    expect(editor.getHTML()).toBe('<p><span data-note="뜻">ab<strong>굵은</strong>cd</span></p>');
    editor.destroy();
  });

  it('⚠️ 다른 풀이를 입은 줄바꿈을 붙여 넣어도 표식을 입히지 않는다 — 글자 없는 ☆ 가 찍힌다', () => {
    const editor = referenceEditor('<p><span data-note="B"><span data-shape="star">앞뒤</span></span></p>');
    editor.commands.setTextSelection(2);
    pasteHtml(editor, '<span data-note="A"><br></span>');
    expect(editor.getHTML()).toContain('<span data-note="A"><br></span>');
    editor.destroy();
  });

  it('⚠️ 글자를 골라 그 위에 쳐도 터지지 않는다 — 교체 단계를 되짚는 자리가 문서 밖으로 나가면 편집기가 죽는다', () => {
    const editor = referenceEditor('<p>abcdef</p>');
    editor.view.dispatch(editor.state.tr.insertText('X', 2, 7));
    expect(editor.getHTML()).toBe('<p>aX</p>');
    editor.destroy();
  });

  it('줄바꿈만 붙여 넣어도 풀이는 하나다', () => {
    const editor = referenceEditor('<p><span data-note="풀이">앞뒤</span></p>');
    editor.commands.setTextSelection(2);
    pasteHtml(editor, '<span><br><br></span>');
    expect(editor.getHTML()).toBe('<p><span data-note="풀이">앞<br><br>뒤</span></p>');
    editor.destroy();
  });

  it('Shift+Enter 를 되돌리고 다시 해도 풀이는 하나다', () => {
    const editor = referenceEditor('<p><span data-note="풀이">앞뒤</span></p>');
    editor.chain().setTextSelection(2).setHardBreak().run();
    editor.commands.undo();
    expect(editor.getHTML()).toBe('<p><span data-note="풀이">앞뒤</span></p>');
    editor.commands.redo();
    expect(editor.getHTML()).toBe('<p><span data-note="풀이">앞<br>뒤</span></p>');
    editor.destroy();
  });

  it('⚠️ 풀이가 다른 두 표식 사이의 줄바꿈은 표식을 안 입는다 — 글자 없는 ☆ 가 찍힌다', () => {
    const editor = referenceEditor(
      '<p><span data-note="가"><span data-shape="star">앞</span></span><span data-note="나"><span data-shape="star">뒤</span></span></p>',
    );
    editor.chain().setTextSelection(2).setHardBreak().run();
    expect(editor.getHTML()).toContain('</span></span><br><span data-note="나">');
    editor.destroy();
  });

  it('⚠️ 줄바꿈 뒤 첫 글자의 서식이 안 풀린다 — addMark 가 다음 글자 서식을 지운다', () => {
    const editor = referenceEditor('<p><span data-note="심상"><strong>파도가</strong></span></p>');
    editor.chain().setTextSelection(2).setHardBreak().run();
    expect(editor.getHTML()).toContain('<br>');
    expect(editor.state.storedMarks?.map((mark) => mark.type.name)).toContain('bold');
    editor.destroy();
  });

  it('⚠️ 연달아 들어온 줄바꿈도 풀이를 가르지 않는다', () => {
    const editor = referenceEditor('<p><span data-note="풀이">앞뒤</span></p>');
    editor.commands.insertContentAt(2, [{ type: 'hardBreak' }, { type: 'hardBreak' }]);
    expect(editor.getHTML()).toBe('<p><span data-note="풀이">앞<br><br>뒤</span></p>');
    editor.destroy();
  });

  it('다른 풀이 사이의 줄바꿈은 둘을 잇지 않는다', () => {
    const html = '<p><span data-note="가">앞</span><br><span data-note="나">뒤</span></p>';
    const editor = referenceEditor(html);
    editor.chain().setTextSelection(1).insertContent('x').run();
    expect(editor.getHTML()).toBe('<p>x<span data-note="가">앞</span><br><span data-note="나">뒤</span></p>');
    editor.destroy();
  });
});
