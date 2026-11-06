import type { Mark, Node as ProseMirrorNode, Slice } from '@tiptap/pm/model';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { Mapping, ReplaceAroundStep, ReplaceStep } from '@tiptap/pm/transform';
import { OUTER_MARKS, boxRunAt, sameMark, type DocRange } from './phrase-mark-rules';
import { PHRASE_NOTE_MARK, SHAPE_MARK } from './WorkbookMarks';

/**
 * 풀이가 내용 변경으로 갈라지지 않게 지키는 규칙 둘 — 어느 길로 들어온 변경이든 트랜잭션 단계에서 받는다.
 *
 * ① 풀이·표식 **안쪽에 글자 사이 내용**이 들어오면 그 표시를 입힌다(줄바꿈 · 붙여넣기).
 * ② 풀이 안쪽을 **블록**이 가르면 뒷조각의 풀이를 걷는다(Enter · 구분선 · 표 · 문단 붙여넣기). 풀이는 앞 문단에 남는다.
 * 둘 다 없으면 같은 풀이가 두 번 찍히고 고칠 때 한쪽만 바뀐다.
 *
 * ⚠️ `getChangedRanges` 로 찾지 말 것. 굵게(마크 단계) · `setContent` · 통째 붙여넣기도 구간을 바꾸므로, 원래 있던 줄바꿈까지 새것으로
 *    보여 따로 단 두 풀이가 합쳐진다. 교체 단계의 조각을 직접 본다. 되돌리기도 뺀다 — 풀이 사이 경계였을 수 있다.
 */

/** 안쪽에 내용이 끼어도 이어져야 하는 마크 — 갈라지면 풀이가 두 번 찍히고 △ 가 조각마다 붙는다 */
const MARKS_OVER_INSERTION: readonly string[] = [PHRASE_NOTE_MARK, SHAPE_MARK];

/** 새로 들어온 글자 사이 내용의 구간과 거기에 이어도 되는 마크 */
interface Insertion extends DocRange {
  marks: readonly string[];
}

/** 블록이 가른 풀이의 뒷조각 */
interface NoteCut {
  /** 뒷조각이 시작하는 자리 */
  pos: number;
  mark: Mark;
}

/**
 * 글자 사이에 드는 내용뿐인가 — 줄바꿈 · 평문 붙여넣기 · 글자 붙여넣기가 이 모양이고, 문단이 든 조각은 아니다.
 * @param slice - 넣은 조각
 * @returns 그렇다면 true
 */
function holdsOnlyInline(slice: Slice): boolean {
  if (slice.size === 0 || slice.openStart > 0 || slice.openEnd > 0) return false;
  let only = true;
  slice.content.forEach((node) => {
    if (!node.isInline) only = false;
  });
  return only;
}

/**
 * 그 표시를 안 입은 줄바꿈이 든 조각인가 — 그 줄바꿈은 그 표시의 두 덩이를 가르던 경계일 수 있다.
 * @param slice - 지워지는 조각
 * @param name - 볼 마크
 * @returns 들었으면 true
 */
function holdsBreakWithout(slice: Slice, name: string): boolean {
  let found = false;
  slice.content.descendants((node) => {
    if (node.type.name === 'hardBreak' && !node.marks.some((mark) => mark.type.name === name)) found = true;
  });
  return found;
}

/**
 * 그 구간이 풀이 한 덩이 안에 있었는가 — 양끝 표시가 같아도 사이에 맨 줄바꿈이나 문단 경계가 있으면 따로 단 두 풀이다.
 * @param doc - 바뀌기 전 문서
 * @param from - 구간 시작
 * @param to - 구간 끝
 * @param mark - 풀이
 * @returns 한 덩이 안이면 true
 */
function insideOneNote(doc: ProseMirrorNode, from: number, to: number, mark: Mark): boolean {
  if (!doc.resolve(from).sameParent(doc.resolve(to))) return false;
  let inside = true;
  doc.nodesBetween(from, to, (node) => {
    if (node.isInline && !mark.isInSet(node.marks)) inside = false;
  });
  return inside;
}

/**
 * 트랜잭션들의 교체 단계에서 할 일을 모은다 — 자리는 지금 문서로 옮겨서 낸다.
 * @param transactions - 방금 적용한 트랜잭션들
 * @returns 새로 들어온 내용들과 블록이 가른 풀이들
 */
function collectChanges(transactions: readonly Transaction[]): { insertions: Insertion[]; cuts: NoteCut[] } {
  const insertions: Insertion[] = [];
  const cuts: NoteCut[] = [];
  transactions.forEach((transaction, index) => {
    if (transaction.getMeta('history$')) return;
    const later = transactions.slice(index + 1);
    const toLatest = (pos: number, firstMap: number, assoc: number) => later.reduce(
      (mapped, next) => next.mapping.map(mapped, assoc), transaction.mapping.slice(firstMap).map(pos, assoc),
    );
    transaction.steps.forEach((step, stepIndex) => {
      if (!(step instanceof ReplaceStep || step instanceof ReplaceAroundStep) || step.slice.size === 0) return;
      const doc = transaction.docs[stepIndex];
      // 목록을 붙여 넣으면 뒷글자가 틈(gap)으로 옮겨 간다 — 틈의 시작이 곧 뒷조각의 시작이다
      const end = step instanceof ReplaceAroundStep ? step.gapFrom : step.to;
      // 경계는 트랜잭션 **전** 문서로 본다 — Enter 는 선택 지우기와 나누기가 두 단계라, 중간 문서에서는 경계가 이미 없어 두 풀이가 붙어 있다
      // ⚠️ `mapping.slice(0, n).invert()` 로 쓰지 말 것 — invert 는 slice 의 범위를 무시하고 전체를 뒤집어, 글자를 골라 그 위에 치면 RangeError 가 난다
      const toBefore = new Mapping(transaction.mapping.maps.slice(0, stepIndex)).invert();
      const originalFrom = toBefore.map(step.from, -1);
      const originalTo = toBefore.map(end, 1);
      if (step instanceof ReplaceStep && holdsOnlyInline(step.slice)) {
        const replaced = transaction.before.slice(originalFrom, originalTo);
        const from = toLatest(step.from, stepIndex + 1, 1);
        const to = toLatest(step.from + step.slice.size, stepIndex + 1, -1);
        const marks = MARKS_OVER_INSERTION.filter((name) => !holdsBreakWithout(replaced, name));
        if (from < to) insertions.push({ from, to, marks });
        return;
      }
      const type = doc.type.schema.marks[PHRASE_NOTE_MARK];
      const before = doc.resolve(step.from).nodeBefore;
      const after = doc.resolve(end).nodeAfter;
      const mark = before ? type.isInSet(before.marks) : undefined;
      if (mark && after && sameMark(mark, type.isInSet(after.marks)) && insideOneNote(transaction.before, originalFrom, originalTo, mark)) {
        cuts.push({ pos: toLatest(end, stepIndex, 1), mark });
      }
    });
  });
  return { insertions, cuts };
}

/**
 * 새로 들어온 내용의 바로 양옆이 같은 풀이·표식이면 내용에 그 표시를 입힌다.
 * @param tr - 입힐 트랜잭션
 * @param insertion - 새로 들어온 구간
 */
function coverInsertion(tr: Transaction, insertion: Insertion): void {
  const { from, to } = insertion;
  const $from = tr.doc.resolve(from);
  const $to = tr.doc.resolve(to);
  const { nodeBefore: before } = $from;
  const { nodeAfter: after } = $to;
  if (!before || !after || !$from.sameParent($to)) return;
  for (const name of insertion.marks) {
    const type = tr.doc.type.schema.marks[name];
    const mark = type.isInSet(before.marks);
    if (!mark || !sameMark(mark, type.isInSet(after.marks))) continue;
    const outers = OUTER_MARKS[name].map((outer) => tr.doc.type.schema.marks[outer]);
    // 풀이가 다르면 표식이 같아도 잇지 않는다 — 줄바꿈만 든 표식이 생겨 글자 없는 ☆ 가 찍힌다
    let fits = outers.every((outer) => sameMark(outer.isInSet(before.marks), outer.isInSet(after.marks)));
    tr.doc.nodesBetween(from, to, (node) => {
      if (!node.isInline) return;
      // 제 표시가 있는 내용은 그대로 둔다 — 복사한 풀이를 덮으면 안 된다
      if (type.isInSet(node.marks)) fits = false;
      if (outers.some((outer) => !sameMark(outer.isInSet(before.marks), outer.isInSet(node.marks)))) fits = false;
    });
    if (fits) tr.addMark(from, to, mark);
  }
}

/**
 * 방금 적용한 트랜잭션들 뒤에 풀이·표식을 바로잡는다.
 * @param transactions - 방금 적용한 트랜잭션들
 * @param state - 지금 상태
 * @returns 바로잡을 것이 있으면 그 트랜잭션, 없으면 null
 */
export function keepPhraseRuns(transactions: readonly Transaction[], state: EditorState): Transaction | null {
  const { insertions, cuts } = collectChanges(transactions);
  if (insertions.length === 0 && cuts.length === 0) return null;
  const tr = state.tr;
  insertions.forEach((insertion) => coverInsertion(tr, insertion));
  for (const { pos, mark } of cuts) {
    const run = boxRunAt(state, pos, PHRASE_NOTE_MARK);
    // 자른 자리부터만 걷는다 — 앞쪽은 붙여 넣은 글일 수 있고, 거기 든 같은 풀이는 복사해 온 것이다
    if (run) tr.removeMark(pos, run.to, mark);
  }
  // `addMark` 는 다음 글자에 쓸 서식을 지운다 — 줄바꿈 뒤 첫 글자의 굵게가 풀리지 않게 되돌린다.
  // 다만 이어지지 못한 풀이·표식은 뺀다 — 구절 뒷부분을 줄바꿈으로 바꾸면 남은 표시가 다음 글자에 붙어 같은 풀이가 두 번 찍힌다
  const before = tr.selection.$from.nodeBefore?.marks ?? [];
  const stored = state.storedMarks?.filter((mark) => !MARKS_OVER_INSERTION.includes(mark.type.name) || mark.isInSet(before)) ?? null;
  if (!tr.docChanged && stored?.length === state.storedMarks?.length) return null;
  return tr.setStoredMarks(stored);
}
