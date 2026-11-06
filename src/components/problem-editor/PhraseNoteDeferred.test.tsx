import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import PhraseNoteControls from './PhraseNoteControls';
import { REFERENCE_STARTER_KIT, WORKBOOK_EXTENSIONS } from './WorkbookExtensions';

const editors: Editor[] = [];

/** 참고자료 마크를 든 편집기 */
function buildEditor(content: string): Editor {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = new Editor({ element, extensions: [StarterKit.configure(REFERENCE_STARTER_KIT), ...WORKBOOK_EXTENSIONS], content });
  editors.push(editor);
  return editor;
}

/** 풀이 안 커서로 칸을 열고 글을 친 상태 */
function editExistingNote(text: string) {
  const editor = buildEditor('<p><span data-note="심상">파도가</span></p>');
  editor.commands.setTextSelection(2);
  render(<PhraseNoteControls editor={editor} />);
  const input = screen.getByLabelText('구절 풀이') as HTMLInputElement;
  fireEvent.change(input, { target: { value: text } });
  return { editor, input };
}

afterEach(() => {
  cleanup();
  while (editors.length) editors.pop()?.destroy();
});

describe('칸을 떠날 때의 풀이 넣기는 체인이 끝난 뒤, 처음 잡은 풀이에 들어간다', () => {
  it('⚠️ 다른 툴바 단추의 체인 도중에 blur 가 와도 트랜잭션이 안 겹친다 — 사파리는 focus() 가 동기다', async () => {
    const { editor, input } = editExistingNote('새 풀이');
    await act(async () => {
      editor.chain().setTextSelection({ from: 1, to: 4 }).command(() => {
        fireEvent.blur(input);
        return true;
      }).toggleBold().run();
    });
    expect(editor.getHTML()).toBe('<p><span data-note="새 풀이"><strong>파도가</strong></span></p>');
  });

  it('⚠️ 체인이 선택을 옮겨도 친 풀이는 원래 풀이에 들어간다 — 다른 풀이를 덮으면 안 된다', async () => {
    const editor = buildEditor('<p><span data-note="첫">파도가</span> 뒤 <span data-note="둘">구절</span></p>');
    editor.commands.setTextSelection(2);
    render(<PhraseNoteControls editor={editor} />);
    const input = screen.getByLabelText('구절 풀이') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '고친 풀이' } });
    await act(async () => {
      editor.chain().command(() => {
        fireEvent.blur(input);
        return true;
      }).setTextSelection(9).run();
    });
    expect(editor.getHTML()).toBe('<p><span data-note="고친 풀이">파도가</span> 뒤 <span data-note="둘">구절</span></p>');
    expect(editor.state.selection.from).toBe(9);
  });

  it('⚠️ 구분선이 풀이를 갈라도 친 풀이는 앞 문단의 풀이에 들어간다', async () => {
    const { editor, input } = editExistingNote('새 풀이');
    await act(async () => {
      editor.chain().command(() => {
        fireEvent.blur(input);
        return true;
      }).setHorizontalRule().run();
    });
    expect(editor.getHTML()).toContain('<span data-note="새 풀이">파</span>');
    expect(editor.getHTML().match(/data-note=/g)).toHaveLength(1);
  });

  it('⚠️ 풀이 안 일부를 고른 채 구분선이 풀이를 갈라도 친 풀이는 남는 앞 조각에 들어간다', async () => {
    const editor = buildEditor('<p><span data-note="옛">abcdef</span></p>');
    editor.commands.setTextSelection({ from: 2, to: 4 });
    render(<PhraseNoteControls editor={editor} />);
    const input = screen.getByLabelText('구절 풀이') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '새' } });
    await act(async () => {
      editor.chain().command(() => {
        fireEvent.blur(input);
        return true;
      }).setHorizontalRule().run();
    });
    expect(editor.getHTML()).toContain('<span data-note="새">a</span>');
    expect(editor.getHTML().match(/data-note=/g)).toHaveLength(1);
  });

  it('⚠️ 고치던 풀이가 지워졌으면 옆 풀이를 대신 고치지 않는다', async () => {
    const editor = buildEditor('<p><span data-note="옛">abc</span><span data-note="옆">def</span></p>');
    editor.commands.setTextSelection({ from: 1, to: 4 });
    render(<PhraseNoteControls editor={editor} />);
    const input = screen.getByLabelText('구절 풀이') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '새' } });
    await act(async () => {
      editor.chain().command(() => {
        fireEvent.blur(input);
        return true;
      }).setHorizontalRule().run();
    });
    expect(editor.getHTML()).toContain('<span data-note="옆">def</span>');
    expect(editor.getHTML()).not.toContain('data-note="새"');
  });

  it('단추를 누르며 칸을 떠나도 친 풀이와 단추 동작이 둘 다 들어간다', async () => {
    const { editor, input } = editExistingNote('새 풀이');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '구절 아래' }));
      fireEvent.blur(input);
    });
    expect(editor.getHTML()).toBe('<p><span data-note="새 풀이" data-note-pos="over">파도가</span></p>');
  });

  it('⚠️ 풀이 표시만 지워졌으면 옆 풀이를 대신 고치지 않는다 — 글자는 남아 자리가 살아 있다', async () => {
    const editor = buildEditor('<p><span data-note="앞">ab</span><span data-note="뒤">cd</span></p>');
    editor.commands.setTextSelection(4);
    render(<PhraseNoteControls editor={editor} />);
    const input = screen.getByLabelText('구절 풀이') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '새' } });
    await act(async () => {
      editor.chain().command(() => {
        fireEvent.blur(input);
        return true;
      }).extendMarkRange('phraseNote').unsetMark('phraseNote').run();
    });
    expect(editor.getHTML()).toBe('<p><span data-note="앞">ab</span>cd</p>');
  });

  it('⚠️ 풀이 첫 글자가 지워져도 풀이가 남았으면 친 풀이가 들어간다', async () => {
    const editor = buildEditor('<p><span data-note="옛">abcdef</span></p>');
    editor.commands.setTextSelection({ from: 1, to: 2 });
    render(<PhraseNoteControls editor={editor} />);
    const input = screen.getByLabelText('구절 풀이') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '새' } });
    await act(async () => {
      editor.chain().command(() => {
        fireEvent.blur(input);
        return true;
      }).setHorizontalRule().run();
    });
    expect(editor.getHTML()).toContain('<span data-note="새">bcdef</span>');
  });
});
