import type { Editor } from '@tiptap/core';
import type { Mark, Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { CODE_MARK, PHRASE_NOTE_MARK, SHAPE_MARK } from './WorkbookMarks';

/**
 * 구절 풀이와 표식이 겹칠 때의 규칙 — 표식·네모 한 덩이는 풀이 경계를 넘지 못한다.
 *
 * 풀이가 표식의 바깥이다(풀이가 안쪽이면 풀이 경계에서 **풀이**가 갈라져 같은 풀이가 두 번 찍힌다). 그래서 표식이 풀이보다
 * 넓으면 저장할 때 표식이 풀이 경계마다 갈라져 □ 하나가 셋으로 그려진다. 마크 차례는 고정이라 그리기로는 못 고치므로
 * 그런 조작을 툴바에서 막는다. 기존 본문의 네모(`<code>`)도 테두리라 같다.
 *
 * ⚠️ 한 덩이는 `extendMarkRange`·`getMarkRange` 로 재지 않는다. 그 둘은 풀이 경계를 몰라서, 풀이 안 □ 바로 뒤의 다른 □ 까지
 *    한 덩이로 본다(모델에서는 이어져 있어도 화면에서는 두 네모다). `boxRunAt` 이 풀이까지 함께 본다.
 */

/** 테두리로 그려져 갈라지면 티가 나는 마크 */
const BOX_MARKS = [SHAPE_MARK, CODE_MARK] as const;

/** 표식보다 안쪽에 그려지는 마크 — 표식을 더할 때 볼 것 */
export const MARKS_INSIDE_SHAPE = [CODE_MARK] as const;

/** 마크마다 그보다 바깥에 그려지는 마크 — 이것이 달라지는 자리에서 DOM 이 끊긴다(WorkbookMarks.ts 의 우선순위와 같은 차례) */
export const OUTER_MARKS: Readonly<Record<string, readonly string[]>> = {
  [PHRASE_NOTE_MARK]: [],
  [SHAPE_MARK]: [PHRASE_NOTE_MARK],
  [CODE_MARK]: [PHRASE_NOTE_MARK, SHAPE_MARK],
};

/**
 * 둘이 같은 표시인가 — 둘 다 없어도 같다.
 * @param a - 표시
 * @param b - 표시
 * @returns 같으면 true
 */
export function sameMark(a: Mark | undefined, b: Mark | undefined): boolean {
  return a && b ? a.eq(b) : !a && !b;
}

/** 문서 안의 한 구간 */
export interface DocRange {
  from: number;
  to: number;
}

/**
 * 그 자리 글자가 든 표식·네모 한 덩이 — 그 표시와 그보다 바깥 표시가 모두 같은 글자들이고, 화면의 네모 하나다.
 * @param state - 편집기 상태
 * @param pos - 글자 **앞** 자리
 * @param markName - 볼 마크(기본은 표식)
 * @returns 덩이의 구간. 그 표시가 없으면 null
 */
export function boxRunAt(state: EditorState, pos: number, markName: string = SHAPE_MARK): DocRange | null {
  const boxType = state.schema.marks[markName];
  const $pos = state.doc.resolve(pos);
  const start = $pos.start();
  const pieces: (DocRange & { node: ProseMirrorNode })[] = [];
  $pos.parent.forEach((node, offset) => {
    pieces.push({ node, from: start + offset, to: start + offset + node.nodeSize });
  });
  const index = pieces.findIndex((piece) => piece.from <= pos && pos < piece.to);
  if (index < 0) return null;
  const here = pieces[index].node;
  if (!boxType.isInSet(here.marks)) return null;
  const names = [markName, ...(OUTER_MARKS[markName] ?? [])];
  const sameRun = ({ node }: { node: ProseMirrorNode }) => names.every((name) => {
    const type = state.schema.marks[name];
    return sameMark(type.isInSet(here.marks), type.isInSet(node.marks));
  });
  let first = index;
  let last = index;
  while (first > 0 && sameRun(pieces[first - 1])) first -= 1;
  while (last < pieces.length - 1 && sameRun(pieces[last + 1])) last += 1;
  return { from: pieces[first].from, to: pieces[last].to };
}

/**
 * 표식을 고치고 지울 구간 — 고른 범위의 양 끝이 든 덩이까지 넓힌다(커서만 있으면 그 덩이).
 * @param state - 편집기 상태
 * @returns 구간
 */
export function shapeEditRange(state: EditorState): DocRange {
  const { from, to, empty } = state.selection;
  const first = boxRunAt(state, from);
  const last = boxRunAt(state, empty ? from : to - 1);
  return { from: Math.min(from, first?.from ?? from), to: Math.max(to, last?.to ?? to) };
}

/**
 * 고른 범위가 풀이 한 덩이 안에 온전히 드는가.
 * ⚠️ `isActive` 로는 모른다 — 표시 없는 줄바꿈을 건너뛰어서, 줄바꿈부터 풀이 앞부분까지 고른 범위도 '풀이 안' 이라고 답한다.
 *    그 범위로 고치면 `extendMarkRange` 가 줄바꿈에서 못 넓혀 풀이가 둘로 갈린다.
 * @param state - 편집기 상태
 * @returns 온전히 들면 true
 */
export function selectionInOneNote(state: EditorState): boolean {
  const { from, to } = state.selection;
  const run = boxRunAt(state, from, PHRASE_NOTE_MARK);
  return run !== null && to <= run.to;
}

/**
 * 고른 범위에 표시를 더하면 표식·네모가 갈라지는가 — 한 덩이가 고른 범위 밖까지 이어지면 갈라진다.
 * 범위 밖으로 이어지는 덩이는 반드시 범위 양 끝 글자에 걸리므로 양 끝만 본다(고른 글자마다 재면 문단 길이의 제곱이다).
 * @param state - 편집기 상태
 * @param names - 볼 마크 — 더하는 표시보다 안쪽에 그려지는 마크(풀이는 표식·네모, 표식은 네모)
 * @returns 갈라지면 true
 */
export function selectionSplitsBox(state: EditorState, names: readonly string[] = BOX_MARKS): boolean {
  const { from, to, empty } = state.selection;
  if (empty) return false;
  return names.some((name) => {
    const head = boxRunAt(state, from, name);
    const tail = boxRunAt(state, to - 1, name);
    return (head !== null && head.from < from) || (tail !== null && tail.to > to);
  });
}

/**
 * 고른 범위에 표식을 그리면 풀이 경계를 넘는가 — 범위 안의 글자가 모두 같은 풀이(또는 모두 풀이 없음)여야 넘지 않는다.
 * @param state - 편집기 상태
 * @returns 넘으면 true
 */
export function shapeWouldCrossNote(state: EditorState): boolean {
  const { from, to } = state.selection;
  const type = state.schema.marks[PHRASE_NOTE_MARK];
  /** 범위 첫 글자의 풀이 — 아직 글자를 못 봤으면 undefined */
  let first: Mark | null | undefined;
  let crosses = false;
  state.doc.nodesBetween(from, to, (node) => {
    if (!node.isInline) return;
    const mark = type.isInSet(node.marks) ?? null;
    if (first === undefined) first = mark;
    else if (mark === null ? first !== null : first === null || !mark.eq(first)) crosses = true;
  });
  return crosses;
}

/**
 * 고른 자리와 다음 글자 서식을 잡아 두었다가 되돌리는 체인 명령 — 풀이·표식을 고칠 때 범위를 넓혔다가 돌아온다.
 * 넓힌 채 두면 다음 표식이 풀이 안 다른 표식까지 바꾸고 이어 친 글이 구절을 덮는다. 선택을 통째로 옮기므로 방향도 지켜진다.
 * @param state - 고치기 전 상태
 * @returns 체인의 `command` 에 넘길 함수
 */
export function restoreCursor(state: EditorState) {
  const { selection, storedMarks } = state;
  const isPhraseMark = (mark: Mark) => mark.type.name === PHRASE_NOTE_MARK || mark.type.name === SHAPE_MARK;
  return ({ tr }: { tr: Transaction }): boolean => {
    tr.setSelection(selection.map(tr.doc, tr.mapping));
    // 풀이·표식은 고친 값으로 갈아 끼운다 — 옛 값을 다음 글자에 입히면 풀이가 갈라진다
    const current = tr.selection.$from.marks().filter(isPhraseMark);
    const others = storedMarks?.filter((mark) => !isPhraseMark(mark));
    tr.setStoredMarks(others ? current.reduce<readonly Mark[]>((set, mark) => mark.addToSet(set), others) : null);
    return true;
  };
}

/**
 * 구간을 잡아 두고 이후 변경에 맞춰 옮긴다 — 미뤄서 하는 일이 그 사이 움직인 선택에 걸리지 않게.
 * @param editor - 편집기
 * @param range - 잡아 둘 구간(글자가 하나 이상 든 구간)
 * @returns 지금까지 옮긴 구간을 내주고 따라가기를 그치는 함수 — 구간의 글자가 지워졌으면 null(옆 표시를 대신 고치면 안 된다)
 */
export function followRange(editor: Editor, range: DocRange): () => DocRange | null {
  let { from, to } = range;
  const follow = ({ transaction }: { transaction: Transaction }) => {
    from = transaction.mapping.map(from, 1);
    to = transaction.mapping.map(to, -1);
  };
  editor.on('transaction', follow);
  return () => {
    editor.off('transaction', follow);
    return from < to ? { from, to } : null;
  };
}

/**
 * 고칠 풀이를 잡아 둘 구간 — 풀이 한 덩이 전체다. 고른 글자만 잡으면 그 글자가 지워졌을 때 풀이가 남아 있어도 친 글을 잃는다.
 * @param state - 편집기 상태
 * @returns 구간(풀이 안이 아니면 고른 구간)
 */
export function noteAnchor(state: EditorState): DocRange {
  const { from, to } = state.selection;
  return boxRunAt(state, from, PHRASE_NOTE_MARK) ?? { from, to };
}
