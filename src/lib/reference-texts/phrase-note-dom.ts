import { groupBands, groupLines, placeBand, type BandNote, type NoteBand } from './phrase-note-layout';

/**
 * 구절 풀이 자리를 화면에서 재서 쓴다 — `reference-phrase-marks.css` 의 보기 화면 규칙이 읽는 값을 만든다.
 *
 * 재기 → 계산 → 쓰기를 한꺼번에 하고 한 번 돈다. 행간과 받침은 세로만 바꾸고 줄바꿈은 그대로라 다시 재지 않아도 된다.
 * 잴 수 없는 풀이(jsdom · 숨은 화면)는 건드리지 않는다. 그래도 구절 밑에 그려지고 겹침만 안 풀린다.
 */

/** 재는 동안 인쇄 치수를 흉내 내는 클래스(reference-sheet.css) */
const PRINT_METRICS_CLASS = 'ref-sheet--print-metrics';
const NOTE_VARS = ['--note-dx', '--note-dy', '--note-shift', '--note-w', '--note-strut'] as const;
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
  fragments: (span: HTMLElement) => readonly { left: number; right: number; top: number; bottom: number }[];
  note: (span: HTMLElement) => NoteMetrics;
  block: (block: HTMLElement) => BlockBox;
}

/** 한 번 돈 결과 */
export interface PhraseNoteSummary {
  notes: number;
  wrapped: number;
  maxRows: number;
}

interface MeasuredNote {
  id: number;
  span: HTMLElement;
  over: boolean;
  block: HTMLElement;
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** 구절이 꺾였으면 첫 조각 높이 */
  firstHeight: number | null;
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

const BROWSER_MEASURE: NoteMeasure = {
  fragments: (span) => Array.from(span.getClientRects()),
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

function clearNotes(spans: readonly HTMLElement[]): void {
  for (const span of spans) {
    NOTE_VARS.forEach((name) => span.style.removeProperty(name));
    span.removeAttribute('data-note-fit');
    if (span.getAttribute('style') === '') span.removeAttribute('style');
  }
}

function measureNotes(spans: readonly HTMLElement[], root: HTMLElement, measure: NoteMeasure): MeasuredNote[] {
  const notes: MeasuredNote[] = [];
  for (const [id, span] of spans.entries()) {
    const fragments = measure.fragments(span);
    const first = fragments[0];
    if (!first) continue;
    const size = measure.note(span);
    if (!(size.width > 0) || !(size.height > 0)) continue;
    notes.push({
      id, span, over: isOver(span), block: hostBlock(span, root),
      left: first.left, right: first.right, top: first.top, bottom: first.bottom,
      firstHeight: fragments.length > 1 ? first.bottom - first.top : null,
      width: size.width, height: size.height, rowHeight: size.height,
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

function toBandNote(note: MeasuredNote, pitch: number): BandNote {
  const span = Math.max(1, Math.ceil(note.height / pitch - 0.01));
  return { id: note.id, over: note.over, x0: note.left, phraseRight: note.right, width: note.width, span };
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

function writeBand(band: NoteBand<MeasuredNote>, box: BlockBox): number {
  // ⚠️ 행 높이는 띠에 하나다. 풀이마다 제 글자 크기로 재면 `<small>` 구절의 풀이가 옆 풀이 행과 어긋나 겹친다
  const pitch = Math.max(...band.items.map((note) => note.rowHeight));
  const placed = placeBand(band.items.map((note) => toBandNote(note, pitch)), { left: box.left, right: box.right - RIGHT_SLACK, gap: pitch * 0.8 });
  const edges = bandEdges(band);
  const byId = new Map(band.items.map((note) => [note.id, note]));
  for (const spot of placed.notes) {
    const note = byId.get(spot.id)!;
    const fromEdge = note.over ? note.top - edges.over! : edges.under! - note.bottom;
    const shift = Math.ceil(spot.row * pitch + fromEdge - 0.01);
    if (spot.dx !== 0) note.span.style.setProperty('--note-dx', `${spot.dx}px`);
    if (shift !== 0) note.span.style.setProperty('--note-shift', `${shift}px`);
    if (note.firstHeight !== null && !note.over) note.span.style.setProperty('--note-dy', `${note.firstHeight}px`);
  }
  const strut = strutFor(band, placed.rows * pitch + 2, box);
  const carrier = band.items.find((note) => !note.over) ?? band.items[0];
  if (strut > 0) carrier.span.style.setProperty('--note-strut', `${Math.ceil(strut)}px`);
  return placed.rows;
}

/**
 * 풀이 자리를 다시 잰다. 같은 본문에 몇 번을 돌려도 결과가 같다.
 * @param root - 본문 뿌리
 * @param measure - 재는 함수(테스트용)
 * @returns 요약 — 잴 수 없었으면 null
 */
export function layoutPhraseNotes(root: HTMLElement, measure: NoteMeasure = BROWSER_MEASURE): PhraseNoteSummary | null {
  const spans = Array.from(root.querySelectorAll<HTMLElement>('span[data-note]'));
  if (spans.length === 0) return { notes: 0, wrapped: 0, maxRows: 0 };
  clearNotes(spans);
  const notes = measureNotes(spans, root, measure);
  if (notes.length === 0) return null;

  const boxes = new Map<HTMLElement, BlockBox>();
  for (const note of notes) if (!boxes.has(note.block)) boxes.set(note.block, measure.block(note.block));
  const wrapped = wrapLongNotes(notes, boxes, measure);

  let maxRows = 0;
  for (const [block, box] of boxes) {
    const own = notes.filter((note) => note.block === block);
    const lines = groupLines(own, (note) => note.top, box.lineHeight / 2);
    for (const band of groupBands(lines, (note) => note.over, box.lineHeight * 1.5)) {
      maxRows = Math.max(maxRows, writeBand(band, box));
    }
  }
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
