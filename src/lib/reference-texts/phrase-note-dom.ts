import {
  groupBands, groupLines, mergeLineBoxes, notesToRaise, placeBand, type BandNote, type LineBox, type NoteBand,
} from './phrase-note-layout';
import { NOTE_STRUT_CLASS, firstLetterText, underlineRun } from './underline-run';

/**
 * 구절 풀이 자리를 화면에서 재서 쓴다 — `reference-phrase-marks.css` 의 보기 화면 규칙이 읽는 값을 만든다.
 *
 * 재기 → 계산 → 쓰기를 한꺼번에 하고 한 번 돈다. 행간과 받침은 세로만 바꾸고 줄바꿈은 그대로라 자리를 다시 풀지 않아도 된다.
 * 잴 수 없는 풀이(jsdom · 숨은 화면)는 건드리지 않는다. 그래도 구절 밑에 그려지고 겹침만 안 풀린다.
 *
 * 풀이의 기준은 구절이 든 **밑줄 줄 전체**다(`underline-run.ts`) — 뜻이 문장을 풀기 때문이다. 밑줄이 두 줄에 걸치면 첫 줄과 끝 줄 가운데 긴 쪽 밑
 * 한가운데에 놓는다. 원래 위 풀이만 제 구절이 기준이다(낱말 하나를 가리킨다). 겹치면 한쪽을 위로 올린다(`data-note-pos` 를 잠깐 쓴다).
 */

/**
 * 자리를 재는 풀이 — 구절 밑에 글이 찍히는 해설뿐이다. 낱말 뜻풀이는 ✦ 만 찍고 뜻은 글 끝 어휘 목록으로 간다.
 * ⚠️ 어휘의 `::after` 는 흐름 안의 ✦ 라 재면 안 된다. 자리 변수를 써 봐야 쓰이지 않고 `left` 는 `auto` 라 겹침 계산이 깨진다
 */
export const EXPLANATION_NOTE_SELECTOR = 'span[data-note]:not([data-note-kind="vocab"])';

/** 재는 동안 인쇄 치수를 흉내 내는 클래스(reference-sheet.css) */
const PRINT_METRICS_CLASS = 'ref-sheet--print-metrics';
const NOTE_VARS = ['--note-dx', '--note-dy', '--note-shift', '--note-w', '--note-strut'] as const;
/** 겹쳐서 위로 올린 풀이의 표시 — 다시 잴 때 저장된 자리로 되돌린다 */
const RAISED_ATTR = 'data-note-raised';
/** 칸 끝에 닿지 않게 둘 여유 — 인쇄 줄바꿈과 반올림 오차 */
const RIGHT_SLACK = 2;
/** 꺾인 풀이가 글자 단위로 안 나뉘어 생기는 끝 빈자리 */
const WRAP_SLACK = 1.1;

/** 풀이 글자의 크기 */
export interface NoteMetrics {
  width: number;
  height: number;
}

/** 칸(풀이가 든 블록)의 내용 상자 */
export interface BlockBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
  lineHeight: number;
}

/** 화면 재기 — 테스트가 갈아 끼운다 */
export interface NoteMeasure {
  fragments: (span: HTMLElement) => readonly LineBox[];
  /** 구절이 든 밑줄 줄의 줄 상자 — 위에서 아래로. 없으면 구절 조각이 곧 줄이다 */
  lines?: (span: HTMLElement) => readonly LineBox[];
  note: (span: HTMLElement) => NoteMetrics;
  block: (block: HTMLElement) => BlockBox;
}

/** 한 번 돈 결과 */
export interface PhraseNoteSummary {
  notes: number;
  wrapped: number;
  maxRows: number;
}

type AnchorKind = 'phrase' | 'first' | 'last';

interface MeasuredNote {
  id: number;
  span: HTMLElement;
  over: boolean;
  block: HTMLElement;
  /** 기준 줄 상자 */
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** 기준 줄이 무엇인가 — 제 구절(저장된 위 풀이) · 밑줄 줄의 첫 줄 · 끝 줄 */
  anchor: AnchorKind;
  /** 구절 첫 조각 — 풀이 자리 변수의 원점이다. 줄 끝에서 시작한 구절은 폭 0 인 조각이 윗줄에 하나 있다 */
  spanLeft: number;
  spanTop: number;
  /** 구절 끝 조각의 밑 — `top: 100%` 가 가리킨다 */
  lastBottom: number;
  /** 위아래로 얼마나 띄울까 — 받침이 줄을 민 뒤에 다시 쓸 때 쓴다 */
  shift: number;
  width: number;
  /** 풀이 전체 높이 — 꺾였으면 여러 행이다 */
  height: number;
  /** 풀이 한 행 높이 */
  rowHeight: number;
}

function isOver(span: HTMLElement): boolean {
  return span.getAttribute('data-note-pos') === 'over';
}

function browserBlock(block: HTMLElement): BlockBox {
  const style = getComputedStyle(block);
  const rect = block.getBoundingClientRect();
  const px = (value: string) => parseFloat(value) || 0;
  return {
    left: rect.left + px(style.paddingLeft) + px(style.borderLeftWidth),
    right: rect.right - px(style.paddingRight) - px(style.borderRightWidth),
    top: rect.top + px(style.paddingTop) + px(style.borderTopWidth),
    bottom: rect.bottom - px(style.paddingBottom) - px(style.borderBottomWidth),
    lineHeight: parseFloat(style.lineHeight),
  };
}

/** 밑줄 줄을 줄 상자로 — 다른 줄로 꺾인 글자는 상자가 따로 나온다 */
function browserLines(span: HTMLElement): LineBox[] {
  const run = underlineRun(span);
  if (!run) return [];
  const range = span.ownerDocument.createRange();
  range.setStart(run.first, 0);
  range.setEnd(run.last, run.last.length);
  return mergeLineBoxes(Array.from(range.getClientRects()));
}

const BROWSER_MEASURE: NoteMeasure = {
  fragments: (span) => Array.from(span.getClientRects()),
  lines: browserLines,
  note: (span) => {
    const style = getComputedStyle(span, '::after');
    return { width: parseFloat(style.width), height: parseFloat(style.height) };
  },
  block: browserBlock,
};

function hostBlock(span: HTMLElement, root: HTMLElement): HTMLElement {
  for (let node = span.parentElement; node && node !== root; node = node.parentElement) {
    const display = getComputedStyle(node).display;
    if (!display.startsWith('inline') && display !== 'contents') return node;
  }
  return root;
}

function clearNotes(root: HTMLElement, spans: readonly HTMLElement[]): void {
  root.querySelectorAll(`.${NOTE_STRUT_CLASS}`).forEach((strut) => {
    const parent = strut.parentNode;
    strut.remove();
    // 받침을 넣느라 가른 글자 노드를 도로 잇는다
    parent?.normalize();
  });
  for (const span of spans) {
    NOTE_VARS.forEach((name) => span.style.removeProperty(name));
    span.removeAttribute('data-note-fit');
    if (span.hasAttribute(RAISED_ATTR)) {
      span.removeAttribute(RAISED_ATTR);
      span.removeAttribute('data-note-pos');
    }
    if (span.getAttribute('style') === '') span.removeAttribute('style');
  }
}

/** 글자가 있는 조각 — 줄 끝에서 시작한 구절의 폭 0 조각은 뺀다(없으면 그대로) */
function solidFragments(fragments: readonly LineBox[]): readonly LineBox[] {
  const solid = fragments.filter((box) => box.right > box.left);
  return solid.length > 0 ? solid : fragments;
}

/** 기준 줄 — 저장된 위 풀이는 제 구절, 나머지는 밑줄 줄의 첫 줄과 끝 줄 가운데 긴 쪽이다(한 줄이면 끝 줄로 친다) */
function anchorKind(over: boolean, lines: readonly LineBox[]): AnchorKind {
  if (over || lines.length === 0) return 'phrase';
  const first = lines[0];
  const end = lines[lines.length - 1];
  return lines.length === 1 || end.right - end.left > first.right - first.left ? 'last' : 'first';
}

/** 지금 화면에서 기준 줄 상자 */
function anchorBox(kind: AnchorKind, own: readonly LineBox[], lines: readonly LineBox[]): LineBox {
  if (kind === 'phrase') return own[0];
  return kind === 'last' ? lines[lines.length - 1] : lines[0];
}

function measureNotes(spans: readonly HTMLElement[], root: HTMLElement, measure: NoteMeasure): MeasuredNote[] {
  const notes: MeasuredNote[] = [];
  for (const [id, span] of spans.entries()) {
    const fragments = measure.fragments(span);
    const first = fragments[0];
    if (!first) continue;
    const size = measure.note(span);
    if (!(size.width > 0) || !(size.height > 0)) continue;
    const over = isOver(span);
    const own = solidFragments(fragments);
    const measured = measure.lines?.(span);
    const lines = measured && measured.length > 0 ? measured : own;
    const anchor = anchorKind(over, lines);
    const box = anchorBox(anchor, own, lines);
    notes.push({
      id, span, over, block: hostBlock(span, root),
      left: box.left, right: box.right, top: box.top, bottom: box.bottom, anchor,
      spanLeft: first.left, spanTop: first.top, lastBottom: fragments[fragments.length - 1].bottom,
      shift: 0, width: size.width, height: size.height, rowHeight: size.height,
    });
  }
  return notes;
}

/** 칸보다 긴 풀이를 꺾고 실제로 몇 행이 됐는지 다시 읽는다 */
function wrapLongNotes(notes: readonly MeasuredNote[], boxes: Map<HTMLElement, BlockBox>, measure: NoteMeasure): number {
  const long = notes.filter((note) => {
    const box = boxes.get(note.block)!;
    return note.width > box.right - box.left - RIGHT_SLACK;
  });
  for (const note of long) {
    const box = boxes.get(note.block)!;
    const room = box.right - box.left - RIGHT_SLACK;
    const count = Math.ceil((note.width * WRAP_SLACK) / room);
    note.width = Math.min(room, Math.ceil((note.width * WRAP_SLACK) / count));
    note.span.setAttribute('data-note-fit', 'wrap');
    note.span.style.setProperty('--note-w', `${note.width}px`);
  }
  for (const note of long) note.height = measure.note(note.span).height;
  return long.length;
}

/** 기준 줄 한가운데에 뒀을 때 풀이 왼쪽 끝 */
function centeredStart(note: MeasuredNote): number {
  return note.left + (note.right - note.left - note.width) / 2;
}

function toBandNote(note: MeasuredNote, pitch: number): BandNote {
  const span = Math.max(1, Math.ceil(note.height / pitch - 0.01));
  return { id: note.id, over: note.over, x0: centeredStart(note), phraseRight: note.right, width: note.width, span };
}

/** 겹치는 아래 풀이의 한쪽을 위로 올린다 — 같은 기준 줄의 위라 가운데는 그대로다 */
function raiseClashes(own: readonly MeasuredNote[], box: BlockBox): void {
  const room = box.right - RIGHT_SLACK;
  const lines = groupLines(own, (note) => note.top, box.lineHeight / 2).map((line) => ({
    top: line.top,
    items: line.items.map((note) => {
      const start = Math.max(box.left, Math.min(centeredStart(note), room - note.width));
      return { id: note.id, start, end: start + note.width, over: note.over, movable: note.height <= note.rowHeight };
    }),
  }));
  const raised = notesToRaise(lines, Math.max(...own.map((note) => note.rowHeight)) * 0.8, box.lineHeight * 1.5);
  for (const note of own) {
    if (!raised.has(note.id)) continue;
    note.over = true;
    note.span.setAttribute('data-note-pos', 'over');
    note.span.setAttribute(RAISED_ATTR, '');
  }
}

/** 띠의 두 기준선 — 아래 풀이는 가장 낮은 글자 밑, 위 풀이는 가장 높은 글자 위에서 잰다 */
function bandEdges(band: NoteBand<MeasuredNote>): { under: number | null; over: number | null } {
  const unders = band.items.filter((note) => !note.over);
  const overs = band.items.filter((note) => note.over);
  return {
    under: unders.length > 0 ? Math.max(...unders.map((note) => note.bottom)) : null,
    over: overs.length > 0 ? Math.min(...overs.map((note) => note.top)) : null,
  };
}

/** 줄 사이 공간에 이 행들을 넣으려면 그 줄을 얼마나 늘릴까 — 0 이면 행간으로 충분하다 */
function strutFor(band: NoteBand<MeasuredNote>, need: number, box: BlockBox): number {
  const { under, over } = bandEdges(band);
  const leading = box.lineHeight - Math.max(...band.items.map((note) => note.bottom - note.top));
  const nearEdge = box.lineHeight * 0.75;
  let room = leading;
  if (under !== null && over !== null) room = over - under;
  else if (under !== null && box.bottom - under < nearEdge) room = leading / 2;
  else if (over !== null && over - box.top < nearEdge) room = leading / 2;
  return need > room ? box.lineHeight / 2 + need - room : 0;
}

/**
 * 세로 자리를 쓴다. 인라인 위치의 원점은 구절 첫 조각이고 `top: 100%` 는 끝 조각 밑이다.
 * 끝 조각 밑이면 쓰지 않는다 — 앞줄이 벌어져도 CSS 가 따라간다. 위 풀이의 `bottom: 100%` 는 첫 조각 위다.
 */
function writeVertical(note: MeasuredNote): void {
  const { style } = note.span;
  const under = !note.over && Math.abs(note.bottom - note.lastBottom) >= 1;
  const shift = note.over ? note.shift + note.spanTop - note.top : note.shift;
  if (shift !== 0) style.setProperty('--note-shift', `${shift}px`);
  else style.removeProperty('--note-shift');
  if (under) style.setProperty('--note-dy', `${note.bottom - note.spanTop}px`);
}

/** 첫 글자(공백이 아닌 첫 글자 묶음) 바로 뒤 — 빈 받침이 그 글자와 같은 줄에 남는다. 앞에 두면 줄바꿈 자리 뒤라 윗줄로 붙을 수 있다 */
function afterFirstLetter(text: Text): { parent: Node; before: Node | null } | null {
  const start = text.data.search(/\S/);
  if (start < 0 || !text.parentNode) return null;
  const [first] = new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(text.data.slice(start));
  const rest = text.splitText(start + (first?.segment.length ?? 1));
  return { parent: text.parentNode, before: rest };
}

/**
 * 줄을 늘린다 — 구절 첫 조각 줄이면 `::before`, 아니면 기준 줄의 글자 옆에 빈 받침을 넣는다.
 * 끝 줄은 밑줄 끝 글자 뒤, 첫 줄과 제 구절은 첫 글자 뒤다. 빈 요소는 붙은 글자의 줄에 남는다.
 * ⚠️ 줄 끝에서 시작한 구절은 첫 조각(폭 0)이 윗줄이라 `::before` 가 거기 붙는다 — 그때도 글자 옆 받침을 쓴다.
 */
function putStrut(note: MeasuredNote, px: number): void {
  if (Math.abs(note.top - note.spanTop) < 1) {
    note.span.style.setProperty('--note-strut', `${px}px`);
    return;
  }
  const strut = note.span.ownerDocument.createElement('span');
  strut.className = NOTE_STRUT_CLASS;
  strut.style.setProperty('--note-strut', `${px}px`);
  if (note.over) strut.setAttribute('data-over', '');
  const run = underlineRun(note.span);
  if (note.anchor === 'last' && run) {
    run.last.parentNode?.insertBefore(strut, run.last.nextSibling);
    return;
  }
  const text = note.anchor === 'first' && run ? firstLetterText(note.span, run.first, run.last) : firstLetterText(note.span);
  const spot = text ? afterFirstLetter(text) : null;
  if (spot) spot.parent.insertBefore(strut, spot.before);
  else note.span.prepend(strut);
}

/** 받침이 줄을 밀었으면 세로 값을 다시 쓴다 — 기준 줄은 처음 고른 그대로이고(위 풀이는 제 구절) 자리도 그대로다 */
function refreshAnchors(notes: readonly MeasuredNote[], measure: NoteMeasure): void {
  for (const note of notes) {
    const fragments = measure.fragments(note.span);
    if (fragments.length === 0) continue;
    const own = solidFragments(fragments);
    const measured = measure.lines?.(note.span);
    const box = anchorBox(note.anchor, own, measured && measured.length > 0 ? measured : own);
    const lastBottom = fragments[fragments.length - 1].bottom;
    if (!box || (Math.abs(box.top - note.top) < 1 && Math.abs(fragments[0].top - note.spanTop) < 1 && Math.abs(lastBottom - note.lastBottom) < 1)) continue;
    note.top = box.top;
    note.bottom = box.bottom;
    note.spanTop = fragments[0].top;
    note.lastBottom = lastBottom;
    writeVertical(note);
  }
}

function writeBand(band: NoteBand<MeasuredNote>, box: BlockBox): number {
  // ⚠️ 행 높이는 띠에 하나다. 풀이마다 제 글자 크기로 재면 `<small>` 구절의 풀이가 옆 풀이 행과 어긋나 겹친다
  const pitch = Math.max(...band.items.map((note) => note.rowHeight));
  const placed = placeBand(band.items.map((note) => toBandNote(note, pitch)), { left: box.left, right: box.right - RIGHT_SLACK, gap: pitch * 0.8 });
  const edges = bandEdges(band);
  const byId = new Map(band.items.map((note) => [note.id, note]));
  for (const spot of placed.notes) {
    const note = byId.get(spot.id)!;
    const fromEdge = note.over ? note.top - edges.over! : edges.under! - note.bottom;
    note.shift = Math.ceil(spot.row * pitch + fromEdge - 0.01);
    const dx = Math.round(centeredStart(note) + spot.dx - note.spanLeft);
    if (dx !== 0) note.span.style.setProperty('--note-dx', `${dx}px`);
    writeVertical(note);
  }
  const strut = strutFor(band, placed.rows * pitch + 2, box);
  const carrier = band.items.find((note) => !note.over) ?? band.items[0];
  if (strut > 0) putStrut(carrier, Math.ceil(strut));
  return placed.rows;
}

/**
 * 풀이 자리를 다시 잰다. 같은 본문에 몇 번을 돌려도 결과가 같다.
 * @param root - 본문 뿌리
 * @param measure - 재는 함수(테스트용)
 * @returns 요약 — 잴 수 없었으면 null
 */
export function layoutPhraseNotes(root: HTMLElement, measure: NoteMeasure = BROWSER_MEASURE): PhraseNoteSummary | null {
  const spans = Array.from(root.querySelectorAll<HTMLElement>(EXPLANATION_NOTE_SELECTOR));
  if (spans.length === 0) return { notes: 0, wrapped: 0, maxRows: 0 };
  clearNotes(root, spans);
  const notes = measureNotes(spans, root, measure);
  if (notes.length === 0) return null;

  const boxes = new Map<HTMLElement, BlockBox>();
  for (const note of notes) if (!boxes.has(note.block)) boxes.set(note.block, measure.block(note.block));
  const wrapped = wrapLongNotes(notes, boxes, measure);

  let maxRows = 0;
  for (const [block, box] of boxes) {
    const own = notes.filter((note) => note.block === block);
    raiseClashes(own, box);
    const lines = groupLines(own, (note) => note.top, box.lineHeight / 2);
    for (const band of groupBands(lines, (note) => note.over, box.lineHeight * 1.5)) {
      maxRows = Math.max(maxRows, writeBand(band, box));
    }
  }
  refreshAnchors(notes, measure);
  return { notes: notes.length, wrapped, maxRows };
}

/**
 * 인쇄 치수로 잰다 — 인쇄 쪽을 미리 재 볼 길이 없어 그 치수를 잠깐 흉내 낸다. 동기라 화면에는 안 보인다.
 * @param root - 본문 뿌리
 * @param measure - 재는 함수(테스트용)
 * @returns 요약
 */
export function layoutPhraseNotesForPrint(root: HTMLElement, measure: NoteMeasure = BROWSER_MEASURE): PhraseNoteSummary | null {
  root.classList.add(PRINT_METRICS_CLASS);
  try {
    return layoutPhraseNotes(root, measure);
  } finally {
    root.classList.remove(PRINT_METRICS_CLASS);
  }
}
