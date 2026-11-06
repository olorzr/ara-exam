import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import { Table, TableRow } from '@tiptap/extension-table';
import { CustomTableCell, CustomTableHeader } from '@/components/exam-builder/CustomTableCell';
import PhraseNoteControls from './PhraseNoteControls';
import { REFERENCE_STARTER_KIT, WORKBOOK_EXTENSIONS } from './WorkbookExtensions';

const editors: Editor[] = [];

/** 참고자료 마크와 표를 든 편집기 */
function buildEditor(content: string): Editor {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = new Editor({
    element,
    extensions: [StarterKit.configure(REFERENCE_STARTER_KIT), Table, TableRow, CustomTableCell, CustomTableHeader, ...WORKBOOK_EXTENSIONS],
    content,
  });
  editors.push(editor);
  return editor;
}

/** 범위를 고른 뒤 툴바를 그린다 */
function renderWith(content: string, from: number, to: number): Editor {
  const editor = buildEditor(content);
  editor.commands.setTextSelection({ from, to });
  render(<PhraseNoteControls editor={editor} />);
  return editor;
}

const shapeSelect = () => screen.getByLabelText('표식') as HTMLSelectElement;

afterEach(() => {
  cleanup();
  while (editors.length) editors.pop()?.destroy();
});

describe('PhraseNoteControls', () => {
  it('구절을 고르면 풀이 달기가 나오고 커서만 있으면 안 나온다', () => {
    const editor = renderWith('<p>푸른 파도가</p>', 1, 3);
    expect(screen.getByRole('button', { name: '풀이 달기' })).toBeTruthy();
    act(() => { editor.commands.setTextSelection(2); });
    expect(screen.queryByRole('button', { name: '풀이 달기' })).toBeNull();
  });

  it('풀이 안 커서면 지금 풀이가 칸에 뜨고 지우기가 전체를 걷는다', () => {
    const editor = buildEditor('<p><span data-note="심상">파도가</span></p>');
    editor.commands.setTextSelection(2);
    render(<PhraseNoteControls editor={editor} />);
    expect((screen.getByLabelText('구절 풀이') as HTMLInputElement).value).toBe('심상');
    fireEvent.click(screen.getByRole('button', { name: '풀이 지우기' }));
    expect(editor.getHTML()).toBe('<p>파도가</p>');
  });

  /** 풀이 달기를 눌러 글을 친 칸 */
  const openNote = (text: string) => {
    fireEvent.click(screen.getByRole('button', { name: '풀이 달기' }));
    const input = screen.getByLabelText('구절 풀이');
    fireEvent.change(input, { target: { value: text } });
    return input;
  };

  it('⚠️ Esc 처리 도중에 blur 가 와도 풀이를 안 넣는다 — 사파리는 focus() 가 동기다', () => {
    const editor = renderWith('<p>푸른 파도가</p>', 1, 3);
    const input = openNote('버릴 풀이');
    act(() => {
      fireEvent.keyDown(input, { key: 'Escape' });
      fireEvent.blur(input);
    });
    expect(editor.getHTML()).toBe('<p>푸른 파도가</p>');
  });

  it('⚠️ Enter 처리 도중에 blur 가 와도 풀이는 한 번만 들어간다', () => {
    const editor = renderWith('<p>푸른 파도가</p>', 1, 3);
    const input = openNote('심상');
    let updates = 0;
    editor.on('update', () => { updates += 1; });
    act(() => {
      fireEvent.keyDown(input, { key: 'Enter' });
      fireEvent.blur(input);
    });
    expect(editor.getHTML()).toBe('<p><span data-note="심상">푸른</span> 파도가</p>');
    expect(updates).toBe(1);
  });

  it('칸을 떠나면 친 풀이가 들어간다', async () => {
    const editor = renderWith('<p>푸른 파도가</p>', 1, 3);
    const input = openNote('심상');
    await act(async () => { fireEvent.blur(input); });
    expect(editor.getHTML()).toBe('<p><span data-note="심상">푸른</span> 파도가</p>');
  });

  it('⚠️ 못 넣는 글자면 Enter 로 칸을 닫지 않는다 — 친 글이 말없이 사라지면 안 된다', () => {
    renderWith('<p>푸른 파도가</p>', 1, 3);
    const input = openNote('현실 > 이상');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByLabelText('구절 풀이')).toBe(input);
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  /** 풀이 안 커서로 칸을 열고 글을 친 상태 */
  const editExistingNote = (text: string) => {
    const editor = buildEditor('<p><span data-note="심상">파도가</span></p>');
    editor.commands.setTextSelection(2);
    render(<PhraseNoteControls editor={editor} />);
    const input = screen.getByLabelText('구절 풀이') as HTMLInputElement;
    fireEvent.change(input, { target: { value: text } });
    return { editor, input };
  };

  it('⚠️ 풀이를 고쳐도 커서는 제자리다 — 넓힌 채 두면 이어 친 글이 구절을 덮는다', () => {
    const { editor, input } = editExistingNote('새 풀이');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(editor.getHTML()).toBe('<p><span data-note="새 풀이">파도가</span></p>');
    expect([editor.state.selection.from, editor.state.selection.to]).toEqual([2, 2]);
  });

  it('⚠️ 풀이를 고쳐도 다음 글자 서식이 남는다 — 굵게를 켜 두었으면 그대로다', () => {
    const editor = buildEditor('<p><span data-note="심상">파도가</span></p>');
    editor.commands.setTextSelection(2);
    render(<PhraseNoteControls editor={editor} />);
    act(() => { editor.commands.toggleBold(); });
    fireEvent.click(screen.getByRole('button', { name: '구절 아래' }));
    const stored = editor.state.storedMarks ?? [];
    expect(stored.map((mark) => mark.type.name)).toContain('bold');
    expect(stored.find((mark) => mark.type.name === 'phraseNote')?.attrs['data-note-pos']).toBe('over');
  });

  it('⚠️ 거꾸로 고른 범위는 표식을 고쳐도 방향이 그대로다', () => {
    const editor = buildEditor('<p><span data-shape="box">파도가</span></p>');
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 3, 2)));
    render(<PhraseNoteControls editor={editor} />);
    fireEvent.change(shapeSelect(), { target: { value: 'star' } });
    expect([editor.state.selection.anchor, editor.state.selection.head]).toEqual([3, 2]);
  });

  it('⚠️ 풀이 자리를 바꾸고 표식을 고쳐도 커서는 제자리다', () => {
    const editor = buildEditor('<p><span data-note="심상"><span data-shape="box">파도가</span></span></p>');
    editor.commands.setTextSelection(2);
    render(<PhraseNoteControls editor={editor} />);
    fireEvent.click(screen.getByRole('button', { name: '구절 아래' }));
    expect(editor.state.selection.to).toBe(2);
    fireEvent.change(shapeSelect(), { target: { value: 'star' } });
    expect(editor.getHTML()).toContain('data-shape="star"');
    expect([editor.state.selection.from, editor.state.selection.to]).toEqual([2, 2]);
  });

  it('⚠️ 문단을 넘겨 고르면 풀이 달기가 잠긴다 — 문단마다 같은 풀이가 생긴다', () => {
    renderWith('<p>가나</p><p>다라</p>', 2, 6);
    expect((screen.getByRole('button', { name: '풀이 달기' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('⚠️ 표식·네모 일부에는 풀이를 못 단다', () => {
    renderWith('<p><span data-shape="box">푸른 파도</span></p>', 4, 6);
    expect((screen.getByRole('button', { name: '풀이 달기' }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    renderWith('<p><code>푸른 파도</code></p>', 4, 6);
    expect((screen.getByRole('button', { name: '풀이 달기' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('⚠️ 문단을 넘긴 범위에서는 같은 풀이도 고치지 못한다 — 첫 문단만 잡혀 풀이가 갈린다', () => {
    renderWith('<p><span data-note="같은">가나</span></p><p><span data-note="같은">다라</span></p>', 2, 6);
    expect(screen.queryByRole('button', { name: '풀이 지우기' })).toBeNull();
    expect(screen.queryByLabelText('구절 풀이')).toBeNull();
  });

  it('⚠️ 줄바꿈부터 풀이 앞부분까지 고르면 고치기를 내놓지 않는다 — 풀이가 둘로 갈린다', () => {
    renderWith('<p><br><span data-note="같은">구절이다</span></p>', 1, 4);
    expect(screen.queryByRole('button', { name: '풀이 지우기' })).toBeNull();
  });

  it('⚠️ 네모 일부에는 표식을 못 그린다', () => {
    renderWith('<p><code>푸른 파도</code></p>', 4, 6);
    expect([...shapeSelect().options].find((o) => o.value === 'circle')?.disabled).toBe(true);
  });

  it('⚠️ 표식이 섞인 범위는 섞임으로 보이고 표식 없음으로 지운다', () => {
    const editor = renderWith('<p><span data-shape="box">바다</span>에서 <span data-shape="star">항구</span></p>', 1, 9);
    expect(shapeSelect().value).toBe('__mixed__');
    fireEvent.change(shapeSelect(), { target: { value: '__none__' } });
    expect(editor.getHTML()).toBe('<p>바다에서 항구</p>');
  });

  it('⚠️ 표식 일부에 걸친 범위를 지우면 표식이 통째로 걷힌다 — 안의 네모가 갈라지지 않는다', () => {
    const editor = renderWith('<p><span data-shape="box"><code>abcdef</code></span> tail</p>', 4, 12);
    fireEvent.change(shapeSelect(), { target: { value: '__none__' } });
    expect(editor.getHTML()).toBe('<p><code>abcdef</code> tail</p>');
  });

  it('맨 글자와 표식이 섞인 범위에 표식을 고르면 통째로 붙는다', () => {
    const editor = renderWith('<p><span data-shape="box">바다</span>에서</p>', 1, 5);
    fireEvent.change(shapeSelect(), { target: { value: 'box' } });
    expect(editor.getHTML()).toBe('<p><span data-shape="box">바다에서</span></p>');
  });

  it('⚠️ 풀이 경계에 걸치면 새 표식을 못 고른다 — 표식 없음은 고를 수 있다', () => {
    renderWith('<p>앞 <span data-note="풀이">구절</span></p>', 1, 4);
    const options = [...shapeSelect().options];
    expect(options.find((o) => o.value === 'box')?.disabled).toBe(true);
    expect(options.find((o) => o.value === '__none__')?.disabled).toBe(false);
  });

  it('⚠️ 표 칸을 여러 개 고르면 풀이·표식을 쓰지 않는다 — from·to 가 한 칸만 가리킨다', () => {
    const editor = buildEditor('<table><tbody><tr><td><p>가</p></td></tr><tr><td><p>나</p></td></tr></tbody></table>');
    const cells: number[] = [];
    editor.state.doc.descendants((node, pos) => { if (node.type.name === 'tableCell') cells.push(pos); });
    editor.commands.setCellSelection({ anchorCell: cells[0], headCell: cells[1] });
    render(<PhraseNoteControls editor={editor} />);
    expect(shapeSelect().disabled).toBe(true);
    const add = screen.queryByRole('button', { name: '풀이 달기' }) as HTMLButtonElement | null;
    expect(add?.disabled ?? true).toBe(true);
  });
});
