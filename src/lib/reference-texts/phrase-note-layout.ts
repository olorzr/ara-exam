/**
 * 구절 풀이 자리 잡기 — 순수 계산. 화면을 재는 쪽은 `phrase-note-dom.ts` 다.
 *
 * 띠는 **두 줄 사이 공간 하나**다. 위 줄의 아래 풀이와 아래 줄의 위 풀이가 같은 공간을 나눠 쓰므로 한 묶음으로 푼다.
 * 풀이는 제 구절 밑 가운데에 놓고, 부딪히면 먼저 한쪽을 구절 위로 올린다(`notesToRaise`). 위에도 자리가 없으면 그때 민다.
 * 풀이는 제 구절 밑을 떠나면 어느 구절 것인지 모른다. 그래서 오른쪽으로는 구절 폭 안에서만 밀고, 그래도 부딪히면 다음 행으로 내린다.
 * 행 수에 상한을 두지 않는다 — 풀이마다 제 행을 가지면 언제나 풀리므로 겹침이 남지 않는다.
 */

/** 화면 상자 */
export interface LineBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** 띠 안의 풀이 하나 */
export interface BandNote {
  /** 호출부가 결과를 되짚는 열쇠 */
  id: number;
  /** 구절 위 풀이인가 */
  over: boolean;
  /** 풀이를 두고 싶은 왼쪽 끝 — 기준 줄의 가운데다 */
  x0: number;
  /** 기준 줄의 오른쪽 끝 */
  phraseRight: number;
  /** 풀이 폭 */
  width: number;
  /** 차지하는 행 수 — 칸보다 길어 꺾인 풀이만 2 이상이다 */
  span: number;
}

/** 띠의 범위 */
export interface BandLimits {
  /** 칸 왼쪽 끝 */
  left: number;
  /** 칸 오른쪽 끝 */
  right: number;
  /** 같은 행에서 풀이 사이에 둘 틈 */
  gap: number;
}

/** 풀이 하나의 자리 */
export interface NotePlacement {
  id: number;
  /** 두고 싶은 자리에서 옮긴 거리(px, 정수) */
  dx: number;
  /** 구절에서 몇 번째 행인가 — 아래 풀이는 위에서, 위 풀이는 아래에서 센다 */
  row: number;
}

/** 띠 하나의 답 */
export interface BandPlacement {
  /** 띠가 쓰는 행 수 */
  rows: number;
  notes: NotePlacement[];
}

/** 띠 안에 놓인 풀이 */
interface Taken {
  start: number;
  end: number;
  /** 차지한 행의 처음과 끝 — 위에서 센다 */
  first: number;
  last: number;
  over: boolean;
}

/** 구절 안에서 밀어도 구절이 풀이 위에 남아야 한다 — 이만큼은 겹쳐 둔다 */
const MIN_PHRASE_OVERLAP = 12;

function clampStart(note: BandNote, limits: BandLimits): number {
  return Math.max(limits.left, Math.min(note.x0, limits.right - note.width));
}

/**
 * 같은 폭을 쓰는 두 풀이의 행이 부딪히는가.
 * ⚠️ 행이 달라도 아래 풀이가 위 풀이보다 밑에 오면 부딪힌 것이다. 아래 풀이는 윗줄에서, 위 풀이는 아랫줄에서 재므로
 * 엇갈리면 띠에 남는 틈만큼 겹친다. 띠 안에서는 아래 풀이가 늘 위쪽이다.
 */
function rowsClash(taken: Taken, first: number, last: number, over: boolean): boolean {
  if (taken.first <= last && first <= taken.last) return true;
  if (taken.over === over) return false;
  return over ? taken.last >= first : taken.first <= last;
}

function blockerEnd(all: readonly Taken[], first: number, note: BandNote, start: number, gap: number): number | null {
  const last = first + note.span - 1;
  let blocked: number | null = null;
  for (const taken of all) {
    const near = start < taken.end + gap && taken.start < start + note.width + gap;
    if (near && rowsClash(taken, first, last, note.over)) blocked = Math.max(blocked ?? taken.end, taken.end);
  }
  return blocked;
}

/** 이 행에서 풀이를 둘 왼쪽 끝 — 못 두면 null */
function startInLane(all: readonly Taken[], lane: number, note: BandNote, limits: BandLimits): number | null {
  const start = clampStart(note, limits);
  const blocked = blockerEnd(all, lane, note, start, limits.gap);
  if (blocked === null) return start;
  const pushed = blocked + limits.gap;
  const lastStart = note.phraseRight - Math.min(note.width, MIN_PHRASE_OVERLAP);
  if (pushed > lastStart || pushed + note.width > limits.right) return null;
  return blockerEnd(all, lane, note, pushed, limits.gap) === null ? pushed : null;
}

function laneOrder(note: BandNote, rows: number): number[] {
  const lanes = Array.from({ length: rows - note.span + 1 }, (_, i) => i);
  return note.over ? lanes.reverse() : lanes;
}

function rowOf(note: BandNote, lane: number, rows: number): number {
  return note.over ? rows - lane - note.span : lane;
}

function tryRows(notes: BandNote[], rows: number, limits: BandLimits): NotePlacement[] | null {
  const all: Taken[] = [];
  const placed: NotePlacement[] = [];
  for (const note of notes) {
    let spot: { lane: number; start: number } | null = null;
    for (const lane of laneOrder(note, rows)) {
      const start = startInLane(all, lane, note, limits);
      if (start !== null) { spot = { lane, start }; break; }
    }
    if (!spot) return null;
    all.push({ start: spot.start, end: spot.start + note.width, first: spot.lane, last: spot.lane + note.span - 1, over: note.over });
    placed.push({ id: note.id, dx: Math.round(spot.start - note.x0), row: rowOf(note, spot.lane, rows) });
  }
  return placed;
}

/** 풀이마다 제 행을 준다 — 언제나 풀리는 마지막 답 */
function stackRows(notes: readonly BandNote[], limits: BandLimits): BandPlacement {
  const rows = notes.reduce((sum, note) => sum + note.span, 0);
  let lane = 0;
  const unders = notes.filter((note) => !note.over);
  const placed = [...unders, ...notes.filter((note) => note.over)].map((note) => {
    const spot = { id: note.id, dx: Math.round(clampStart(note, limits) - note.x0), row: rowOf(note, lane, rows) };
    lane += note.span;
    return spot;
  });
  return { rows, notes: placed };
}

/**
 * 띠 하나의 풀이들을 가장 적은 행에 놓는다.
 * @param notes - 띠 안의 풀이
 * @param limits - 칸 범위와 틈
 * @returns 행 수와 풀이마다의 자리
 */
export function placeBand(notes: readonly BandNote[], limits: BandLimits): BandPlacement {
  const ordered = [...notes].sort((a, b) => a.x0 - b.x0 || a.id - b.id);
  const fewest = Math.max(1, ...ordered.map((note) => note.span));
  const most = ordered.reduce((sum, note) => sum + note.span, 0);
  for (let rows = fewest; rows < most; rows += 1) {
    const placed = tryRows(ordered, rows, limits);
    if (placed) return { rows, notes: placed };
  }
  return stackRows(ordered, limits);
}

/**
 * 상자들을 줄로 합친다 — 밑줄 줄의 글자 상자는 낱말마다 여럿이고 폭 없는 받침도 섞인다.
 * @param boxes - 화면 상자들
 * @returns 위에서 아래로 줄 상자들
 */
export function mergeLineBoxes(boxes: readonly LineBox[]): LineBox[] {
  const lines: LineBox[] = [];
  for (const box of [...boxes].filter((item) => item.right > item.left).sort((a, b) => a.top - b.top)) {
    const middle = (box.top + box.bottom) / 2;
    const line = lines.find((item) => middle > item.top && middle < item.bottom);
    if (!line) { lines.push({ left: box.left, right: box.right, top: box.top, bottom: box.bottom }); continue; }
    line.left = Math.min(line.left, box.left);
    line.right = Math.max(line.right, box.right);
    line.top = Math.min(line.top, box.top);
    line.bottom = Math.max(line.bottom, box.bottom);
  }
  return lines;
}

/** 올릴지 따져 볼 풀이 */
export interface RaiseNote {
  id: number;
  /** 가운데에 뒀을 때 왼쪽 끝 */
  start: number;
  end: number;
  over: boolean;
  /** 올려도 되는가 — 칸보다 길어 꺾인 풀이는 안 올린다 */
  movable: boolean;
}

/** 줄 하나 — 같은 높이에 있는 풀이의 묶음 */
export interface NoteLine<T> {
  top: number;
  items: T[];
}

/**
 * 첫 조각 높이로 줄을 묶는다.
 * @param items - 풀이들
 * @param topOf - 풀이의 첫 조각 위쪽
 * @param tolerance - 이보다 가까우면 같은 줄이다
 * @returns 위에서 아래로 줄들
 */
export function groupLines<T>(items: readonly T[], topOf: (item: T) => number, tolerance: number): NoteLine<T>[] {
  const lines: NoteLine<T>[] = [];
  for (const item of [...items].sort((a, b) => topOf(a) - topOf(b))) {
    const line = lines[lines.length - 1];
    if (line && topOf(item) - line.top < tolerance) line.items.push(item);
    else lines.push({ top: topOf(item), items: [item] });
  }
  return lines;
}

/**
 * 가운데에 둔 아래 풀이끼리 겹치면 한쪽을 구절 위로 올린다 — 밀면 가운데를 떠나고 행을 늘리면 줄이 벌어진다.
 * 뒤쪽 풀이를 먼저 올린다. 위쪽 띠에 윗줄의 아래 풀이나 위 풀이가 있어 못 올리면 앞쪽을 올리고, 둘 다 안 되면 그대로 둔다(`placeBand` 가 푼다).
 * @param lines - 위에서 아래로 줄들
 * @param gap - 같은 행에서 풀이 사이에 둘 틈
 * @param adjacent - 두 줄 사이 거리가 이보다 작으면 바로 이어진 줄이다
 * @returns 올릴 풀이의 id
 */
export function notesToRaise(lines: readonly NoteLine<RaiseNote>[], gap: number, adjacent: number): Set<number> {
  const raised = new Set<number>();
  const clash = (a: RaiseNote, b: RaiseNote) => a.start < b.end + gap && b.start < a.end + gap;
  lines.forEach((line, index) => {
    const prev = lines[index - 1];
    const aboveLine = prev && line.top - prev.top < adjacent ? prev.items.filter((note) => !note.over && !raised.has(note.id)) : [];
    const roomAbove = (note: RaiseNote) => (
      note.movable && ![...aboveLine, ...line.items.filter((item) => item.over || raised.has(item.id))].some((other) => clash(other, note))
    );
    let kept: RaiseNote | null = null;
    for (const note of line.items.filter((item) => !item.over).sort((a, b) => a.start - b.start)) {
      if (!kept || !clash(kept, note)) { kept = note; continue; }
      if (roomAbove(note)) { raised.add(note.id); continue; }
      if (roomAbove(kept)) { raised.add(kept.id); kept = note; continue; }
      if (note.end > kept.end) kept = note;
    }
  });
  return raised;
}

/** 띠 — 그 안의 풀이와 맞닿은 줄 */
export interface NoteBand<T> {
  /** 띠 위쪽 줄 — 없으면 이 띠는 칸 맨 위의 위 풀이뿐이다 */
  above: NoteLine<T> | null;
  /** 띠 아래쪽 줄 */
  below: NoteLine<T> | null;
  items: T[];
}

/**
 * 줄들을 띠로 묶는다 — 바로 이어진 두 줄이면 위 줄의 아래 풀이와 아래 줄의 위 풀이를 한 띠에 넣는다.
 * @param lines - 위에서 아래로 줄들
 * @param isOver - 위 풀이인가
 * @param adjacent - 두 줄 사이 거리가 이보다 작으면 바로 이어진 줄이다
 * @returns 띠들
 */
export function groupBands<T>(lines: readonly NoteLine<T>[], isOver: (item: T) => boolean, adjacent: number): NoteBand<T>[] {
  const bands: NoteBand<T>[] = [];
  lines.forEach((line, index) => {
    const overs = line.items.filter(isOver);
    const unders = line.items.filter((item) => !isOver(item));
    const prev = lines[index - 1];
    const last = bands[bands.length - 1];
    if (overs.length > 0) {
      const joins = last && prev && last.above === prev && line.top - prev.top < adjacent;
      if (joins) { last.below = line; last.items.push(...overs); } else bands.push({ above: null, below: line, items: overs });
    }
    if (unders.length > 0) bands.push({ above: line, below: null, items: unders });
  });
  return bands;
}
