'use client';

import { useRef, useState } from 'react';
import { TextSelection } from '@tiptap/pm/state';
import { useEditorState, type Editor } from '@tiptap/react';
import {
  NOTE_KIND_VOCAB, NOTE_POS_OVER, PHRASE_NOTE_MAX, SHAPE_KINDS, SHAPE_LABELS, isPhraseNote,
} from '@/lib/workbook-markup';
import {
  MARKS_INSIDE_SHAPE, boxRunAt, followRange, noteAnchor, restoreCursor, selectionInOneNote, selectionSplitsBox, shapeEditRange,
  shapeWouldCrossNote,
} from './phrase-mark-rules';
import { TOOLBAR_SELECT_CLASS, toolbarButtonClass } from './toolbar-styles';
import { PHRASE_NOTE_MARK, SHAPE_MARK } from './WorkbookMarks';

/** '표식 없음' 센티널 — 빈 문자열 option 은 브라우저마다 다루기가 다르다 */
const NONE = '__none__';

/** 새 풀이 — 자리·갈래를 비워 넣는다. `setMark` 는 글자마다 옛 속성에 합쳐서, 옛 풀이에 걸친 범위가 위·아래나 어휘·해설로 갈린다 */
const NEW_NOTE = (text: string) => ({ 'data-note': text, 'data-note-pos': null, 'data-note-kind': null });

/** 범위에 표식이 섞였을 때 칸에 보이는 값 — 없으면 '표식 없음' 이 이미 골라져 있어 지우는 길이 막힌다 */
const MIXED = '__mixed__';

interface PhraseNoteControlsProps {
  editor: Editor;
}

/**
 * 구절 풀이 · 표식 단추 — 구절을 고르고 '풀이 달기', 커서가 풀이 안에 있으면 고치기 · 위/아래 · 지우기.
 *
 * ⚠️ 고치고 지울 때는 `extendMarkRange` 를 먼저 건다. `updateAttributes` 는 빈 선택에서 마크를 건드리지 않고,
 *    `unsetMark` 는 고른 범위만 지워서 풀이가 반쪽으로 남는다.
 * ⚠️ '풀이 달기' 는 범위를 골랐을 때만 나온다 — 빈 선택의 `setMark` 는 다음에 칠 글자에만 붙는다.
 * @param props - 편집기
 * @returns 단추 묶음
 */
export default function PhraseNoteControls({ editor }: PhraseNoteControlsProps) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const noteAttrs = e.getAttributes(PHRASE_NOTE_MARK);
      const note = typeof noteAttrs['data-note'] === 'string' ? (noteAttrs['data-note'] as string) : null;
      const pos = (noteAttrs['data-note-pos'] as string | null | undefined) ?? null;
      const shape = e.getAttributes(SHAPE_MARK)['data-shape'];
      const { selection } = e.state;
      // 표 칸 여러 개를 고르면 `from`·`to` 가 한 칸만 가리킨다 — 글자를 고른 경우에만 풀이·표식을 쓴다
      const textSelection = selection instanceof TextSelection;
      // 문단을 넘기면 달 때는 문단마다 같은 풀이가 생기고, 고칠 때는 `extendMarkRange` 가 첫 문단만 잡아 풀이가 갈린다
      const oneBlock = textSelection && selection.$from.sameParent(selection.$to);
      // getAttributes 는 범위의 **첫** 표시를 읽는다 — 풀이 한 덩이 안일 때만 그 풀이로 본다
      const noteActive = oneBlock && note !== null && e.isActive(PHRASE_NOTE_MARK) && selectionInOneNote(e.state);
      const shapeActive = typeof shape === 'string' && e.isActive(SHAPE_MARK, { 'data-shape': shape });
      return {
        empty: selection.empty,
        textSelection,
        oneBlock,
        noteActive,
        note: noteActive ? note : null,
        over: noteActive && pos === NOTE_POS_OVER,
        vocab: noteActive && noteAttrs['data-note-kind'] === NOTE_KIND_VOCAB,
        shapeActive,
        shape: shapeActive ? (shape as string) : null,
        mixedShape: typeof shape === 'string' && !shapeActive,
        noteSplitsBox: selectionSplitsBox(e.state),
        shapeSplitsBox: shapeWouldCrossNote(e.state) || selectionSplitsBox(e.state, MARKS_INSIDE_SHAPE),
      };
    },
  });
  const [adding, setAdding] = useState(false);

  /** 풀이 전체를 고쳐도 고른 자리는 그대로 둔다 — 넓힌 채 두면 다음 표식이 풀이 안 다른 표식까지 바꾸고 이어 친 글이 구절을 덮는다 */
  const editNote = (attrs: Record<string, string | null>) => {
    const restore = restoreCursor(editor.state);
    editor.chain().focus().extendMarkRange(PHRASE_NOTE_MARK).updateAttributes(PHRASE_NOTE_MARK, attrs).command(restore).run();
  };

  const removeNote = () => {
    const restore = restoreCursor(editor.state);
    editor.chain().focus().extendMarkRange(PHRASE_NOTE_MARK).unsetMark(PHRASE_NOTE_MARK).command(restore).run();
  };

  /** 풀이 넣기(Enter) */
  const commitNote = (text: string) => {
    setAdding(false);
    if (state.noteActive) editNote({ 'data-note': text });
    else editor.chain().focus().setMark(PHRASE_NOTE_MARK, NEW_NOTE(text)).run();
  };

  /** 입력칸을 닫는다(Esc) — 편집기로 돌아간다. 안 그러면 포커스가 문서 몸통에 떨어져 치는 글이 사라진다 */
  const cancelNote = () => {
    setAdding(false);
    editor.commands.focus();
  };

  /**
   * 칸을 떠날 때 풀이 넣기 — 포커스를 되찾지 않는다(제목 칸으로 옮겨 가는 사람을 끌어오면 안 된다).
   * ⚠️ 체인이 끝난 뒤로 미룬다. 사파리는 단추를 눌러도 포커스가 칸에 남고 `focus()` 가 동기라 어느 툴바 단추든 체인 도중에 blur 가
   *    온다 — 그 자리에서 넣으면 트랜잭션이 겹쳐 'mismatched transaction' 이 난다. 자리는 **지금** 잡는다 — 체인이 선택을 옮기면
   *    다른 풀이를 덮거나 친 글을 잃는다.
   */
  const leaveNote = (text: string | null) => {
    setAdding(false);
    if (text === null) return;
    const { noteActive } = state;
    const { from, to } = editor.state.selection;
    const targetOf = followRange(editor, noteActive ? noteAnchor(editor.state) : { from, to });
    queueMicrotask(() => {
      const target = targetOf();
      if (!target || editor.isDestroyed) return;
      const restore = restoreCursor(editor.state);
      if (!noteActive) {
        editor.chain().setTextSelection(target).setMark(PHRASE_NOTE_MARK, NEW_NOTE(text)).command(restore).run();
        return;
      }
      // 살아남은 앞쪽 끝의 풀이만 고친다 — 블록이 갈랐으면 앞 조각에만 남아 있고, 표시가 지워졌으면 할 일이 없다.
      // `extendMarkRange` 를 쓰지 않는다: 표시가 없는 자리에서 옆 풀이로 비켜 가 그 풀이를 덮는다
      const run = boxRunAt(editor.state, target.from, PHRASE_NOTE_MARK);
      if (run) editor.chain().setTextSelection(run).updateAttributes(PHRASE_NOTE_MARK, { 'data-note': text }).command(restore).run();
    });
  };

  const setShape = (value: string) => {
    const restore = restoreCursor(editor.state);
    const chain = editor.chain().focus();
    // 지울 때는 범위가 걸친 덩이까지 통째로 — 일부만 지우면 표식 안 네모가 갈라지고 표식 조각이 남는다
    if (state.shapeActive || value === NONE) chain.setTextSelection(shapeEditRange(editor.state));
    if (value === NONE) chain.unsetMark(SHAPE_MARK);
    else if (state.shapeActive) chain.updateAttributes(SHAPE_MARK, { 'data-shape': value });
    else chain.setMark(SHAPE_MARK, { 'data-shape': value });
    chain.command(restore).run();
  };

  const noteBlocked = !state.oneBlock ? '풀이는 한 문단 안에서 달아요'
    : state.noteSplitsBox ? '표식·네모 일부에는 풀이를 못 달아요 — 통째로 고르세요' : null;
  // 이미 그려진 표식은 모양을 바꿀 수 있다 — 새로 그릴 때만 막는다
  const shapeBlocked = !state.shapeActive && state.shapeSplitsBox;

  return (
    <>
      {!state.noteActive && !state.empty && !adding && (
        <button
          type="button" className={`${toolbarButtonClass(false)} disabled:opacity-50`} onClick={() => setAdding(true)}
          disabled={noteBlocked !== null}
          title={noteBlocked ?? '고른 구절 바로 밑에 작은 글씨 풀이를 달아요 (시각적 심상)'}
        >
          풀이 달기
        </button>
      )}
      {(adding || state.noteActive) && (
        <NoteInput
          key={state.note ?? '__new__'} initial={state.note ?? ''}
          onCommit={commitNote} onCancel={cancelNote} onLeave={leaveNote}
        />
      )}
      {state.noteActive && (
        <>
          <button
            type="button" className={toolbarButtonClass(state.vocab)} aria-pressed={state.vocab}
            onClick={() => editNote({ 'data-note-kind': state.vocab ? null : NOTE_KIND_VOCAB })}
            title="뜻풀이는 낱말 오른쪽 위 별표와 글 끝 어휘 목록으로, 해설은 구절 밑 글로 보여요"
          >
            어휘
          </button>
          {!state.vocab && (
            <button
              type="button" className={toolbarButtonClass(state.over)} aria-pressed={state.over}
              onClick={() => editNote({ 'data-note-pos': state.over ? null : NOTE_POS_OVER })}
              title="풀이를 구절 위로 올리거나 아래로 내려요"
            >
              {state.over ? '구절 위' : '구절 아래'}
            </button>
          )}
          <button
            type="button" className={toolbarButtonClass(false)}
            onClick={removeNote}
          >
            풀이 지우기
          </button>
        </>
      )}
      <select
        className={TOOLBAR_SELECT_CLASS} aria-label="표식"
        value={state.shape ?? (state.mixedShape ? MIXED : NONE)}
        disabled={!state.textSelection || (state.empty && !state.shapeActive)}
        title={shapeBlocked ? '풀이 경계를 넘거나 네모 일부에 걸치면 표식을 못 그려요 — 통째로 고르세요' : undefined}
        onChange={(e) => setShape(e.target.value)}
      >
        {state.mixedShape && <option value={MIXED} disabled>표식 섞임</option>}
        <option value={NONE}>표식 없음</option>
        {SHAPE_KINDS.map((kind) => <option key={kind} value={kind} disabled={shapeBlocked}>{SHAPE_LABELS[kind]}</option>)}
      </select>
    </>
  );
}

interface NoteInputProps {
  initial: string;
  /** Enter 로 넣는다 */
  onCommit: (text: string) => void;
  /** 넣지 않고 닫는다(Enter·Esc) */
  onCancel: () => void;
  /** 칸을 떠났다 — 넣을 글이 없으면 null */
  onLeave: (text: string | null) => void;
}

/**
 * 풀이 글자 칸 — 칸을 떠날 때(또는 Enter) 한 번에 넣는다. 치는 도중의 글자를 바로 넣으면 정화기가 속성째 지운다.
 * @param props - 처음 글자 · 넣기 · 그만두기
 * @returns 입력칸
 */
function NoteInput({ initial, onCommit, onCancel, onLeave }: NoteInputProps) {
  const [draft, setDraft] = useState(initial);
  /**
   * Enter·Esc 로 닫는 중인가 — 그 뒤에 오는 blur 는 넣기가 아니다.
   * ⚠️ 사파리는 `focus()` 가 동기라 닫기 처리 **도중에** blur 가 온다. 안 막으면 Esc 로 버린 글이 저장되고, 트랜잭션이 겹쳐
   *    'mismatched transaction' 이 난다. state 는 그 사이 안 바뀌므로 ref 로 둔다
   */
  const closing = useRef(false);
  const text = draft.trim();
  const valid = isPhraseNote(text);

  const changed = valid && text !== initial;

  return (
    <input
      className={`w-48 rounded border px-1.5 py-1 text-xs ${valid || !text ? 'border-gray-200' : 'border-red-400'}`}
      aria-label="구절 풀이" aria-invalid={!valid && !!text} placeholder="짧게 — 구절 밑 한 줄 (시각적 심상)"
      title={valid || !text ? undefined : '꺾쇠(<, >)는 풀이에 쓸 수 없어요'} maxLength={PHRASE_NOTE_MAX}
      autoFocus={!initial}
      value={draft}
      onChange={(e) => { closing.current = false; setDraft(e.target.value); }}
      onBlur={() => {
        const closed = closing.current;
        closing.current = false;
        if (!closed) onLeave(changed ? text : null);
      }}
      onKeyDown={(e) => {
        // 한글 조합을 끝내는 Enter 는 넣기가 아니다 — 받으면 마지막 글자가 빠지거나 두 번 들어간다
        if (e.nativeEvent.isComposing) return;
        if (e.key === 'Enter') {
          e.preventDefault();
          // 못 넣는 글자면 칸을 닫지 않는다 — 친 글이 말없이 사라지면 안 된다
          if (!valid && text) return;
          closing.current = true;
          if (changed) onCommit(text);
          else onCancel();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          closing.current = true;
          setDraft(initial);
          onCancel();
        }
      }}
    />
  );
}
