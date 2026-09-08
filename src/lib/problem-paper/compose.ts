/**
 * 문제지 조합 규칙 (순수 함수).
 *
 * 캔버스는 그냥 문항 목록이 아니다. **같은 지문의 문항은 반드시 붙어 있어야 한다** —
 * 흩어지면 인쇄에서 같은 지문이 여러 번 반복되거나 "[3~5]" 머리글이 거짓말을 한다.
 * 이 불변식은 여기서 지키고, DB 의 `create_problem_paper` RPC 가 저장 직전에 한 번 더 본다
 * (앱을 우회한 RPC 직접 호출까지 막으려면 양쪽 모두 필요하다).
 */

/** 캔버스에 놓인 항목 하나 */
export interface PaperItem {
  problemId: string;
  /** 지문 없는 단독 문항은 null */
  passageId: string | null;
}

/** 연속한 같은 지문 묶음 (끝 index 포함) */
export interface PaperGroup {
  passageId: string | null;
  start: number;
  end: number;
}

/**
 * 연속한 같은 지문끼리 묶는다. 지문 없는 문항은 각자 한 묶음이다.
 * @param items - 캔버스 항목
 * @returns 앞에서부터의 묶음 목록
 */
export function groupsOf(items: readonly PaperItem[]): PaperGroup[] {
  const groups: PaperGroup[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const passageId = items[i].passageId;
    const last = groups[groups.length - 1];
    // 지문이 없으면(null) 합치지 않는다 — 서로 무관한 단독 문항들이다
    if (last && passageId !== null && last.passageId === passageId && last.end === i - 1) {
      last.end = i;
    } else {
      groups.push({ passageId, start: i, end: i });
    }
  }
  return groups;
}

/**
 * 같은 지문의 문항이 전부 붙어 있는지 검사한다.
 * @param items - 캔버스 항목
 * @returns 불변식을 지키면 true
 */
export function isContiguous(items: readonly PaperItem[]): boolean {
  const seen = new Set<string>();
  let prev: string | null = null;
  for (const item of items) {
    const id = item.passageId;
    if (id !== null && id !== prev) {
      // 이미 지나간 지문이 다시 나왔다 = 흩어졌다
      if (seen.has(id)) return false;
      seen.add(id);
    }
    prev = id;
  }
  return true;
}

/** 지문 묶음이 끝나는 위치(그 지문의 마지막 문항 다음 자리)를 찾는다 */
function groupEndFor(items: readonly PaperItem[], passageId: string): number | null {
  let end: number | null = null;
  for (let i = 0; i < items.length; i += 1) {
    if (items[i].passageId === passageId) end = i + 1;
  }
  return end;
}

/**
 * 항목을 특정 자리에 넣는다.
 *
 * 규칙:
 *  1. 이미 캔버스에 있는 문항은 건너뛴다(같은 문항을 두 번 출제하지 않는다).
 *  2. 그 지문이 이미 캔버스에 있으면 **요청한 자리를 무시하고** 그 묶음 끝에 붙인다.
 *  3. 지문 묶음 한가운데에 다른 지문을 떨어뜨리면 묶음이 쪼개지므로 묶음 경계로 밀어낸다.
 *
 * @param items - 지금 캔버스
 * @param incoming - 넣을 항목 (여러 개면 순서 유지)
 * @param at - 넣을 자리(0 = 맨 앞). 범위 밖이면 가둔다
 * @returns 새 캔버스 (원본은 바뀌지 않는다)
 */
export function insertItems(
  items: readonly PaperItem[],
  incoming: readonly PaperItem[],
  at: number,
): PaperItem[] {
  const existing = new Set(items.map((i) => i.problemId));
  const fresh = incoming.filter((i) => {
    if (existing.has(i.problemId)) return false;
    existing.add(i.problemId);
    return true;
  });
  if (fresh.length === 0) return [...items];

  let next = [...items];
  for (const item of fresh) {
    let index = Math.min(Math.max(at, 0), next.length);

    if (item.passageId !== null) {
      const groupEnd = groupEndFor(next, item.passageId);
      // 같은 지문이 이미 있으면 그 묶음 끝으로 — 흩어뜨리지 않는다
      if (groupEnd !== null) index = groupEnd;
    }

    // 남의 지문 묶음 한가운데면 그 묶음이 끝나는 자리로 민다
    index = pushOutOfGroup(next, index, item.passageId);
    next = [...next.slice(0, index), item, ...next.slice(index)];
    at = index + 1;
  }
  return next;
}

/** 묶음 한가운데를 가리키면 그 묶음의 끝(또는 시작)으로 옮긴다 */
function pushOutOfGroup(
  items: readonly PaperItem[],
  index: number,
  passageId: string | null,
): number {
  for (const group of groupsOf(items)) {
    if (group.passageId === null || group.passageId === passageId) continue;
    if (index > group.start && index <= group.end) return group.end + 1;
  }
  return index;
}

/**
 * 항목을 다른 자리로 옮긴다. **자기 지문 묶음 안에서만** 움직인다.
 * 묶음 밖으로 끌면 같은 지문이 흩어지므로 경계에서 멈춘다.
 * @param items - 지금 캔버스
 * @param from - 옮길 항목의 현재 index
 * @param to - 목표 index
 * @returns 새 캔버스
 */
export function moveItem(items: readonly PaperItem[], from: number, to: number): PaperItem[] {
  if (from < 0 || from >= items.length) return [...items];

  const item = items[from];
  const group = groupsOf(items).find((g) => from >= g.start && from <= g.end);
  const lower = group && item.passageId !== null ? group.start : 0;
  const upper = group && item.passageId !== null ? group.end : items.length - 1;

  const target = Math.min(Math.max(to, lower), upper);
  if (target === from) return [...items];

  const next = [...items];
  next.splice(from, 1);
  next.splice(target, 0, item);
  return next;
}

/**
 * 지문 묶음 통째로 순서를 바꾼다.
 * @param items - 지금 캔버스
 * @param fromGroup - 옮길 묶음 번호 (groupsOf 기준)
 * @param toGroup - 목표 묶음 번호
 * @returns 새 캔버스
 */
export function moveGroup(
  items: readonly PaperItem[],
  fromGroup: number,
  toGroup: number,
): PaperItem[] {
  const groups = groupsOf(items);
  if (fromGroup < 0 || fromGroup >= groups.length) return [...items];

  const target = Math.min(Math.max(toGroup, 0), groups.length - 1);
  if (target === fromGroup) return [...items];

  const blocks = groups.map((g) => items.slice(g.start, g.end + 1));
  const [moved] = blocks.splice(fromGroup, 1);
  blocks.splice(target, 0, moved);
  return blocks.flat();
}

/**
 * 문항을 뺀다. 지문의 마지막 문항이 빠지면 그 지문도 자연히 사라진다.
 * @param items - 지금 캔버스
 * @param problemId - 뺄 문항 id
 * @returns 새 캔버스
 */
export function removeItem(items: readonly PaperItem[], problemId: string): PaperItem[] {
  return items.filter((i) => i.problemId !== problemId);
}

/**
 * 인쇄에 찍을 문항 번호. 원본 번호와 무관하게 1부터 다시 센다.
 * @param items - 캔버스 항목
 * @returns items 와 같은 길이의 번호 배열
 */
export function renumber(items: readonly PaperItem[]): number[] {
  return items.map((_, i) => i + 1);
}

/**
 * 지문 머리글에 쓸 문항 번호 범위.
 * @param group - 지문 묶음
 * @returns '3~5' 또는 문항이 하나면 '3'
 */
export function groupRangeLabel(group: PaperGroup): string {
  const from = group.start + 1;
  const to = group.end + 1;
  return from === to ? String(from) : `${from}~${to}`;
}
