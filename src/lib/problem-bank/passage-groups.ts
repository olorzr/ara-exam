/**
 * 목록을 **지문별로** 묶는다 (순수 함수).
 *
 * 묶는 방식이 둘이고, 화면이 무엇을 보여 주려는지가 달라서 갈라 둔다.
 *
 *  · `groupRowsByPassage` — **작품으로 훑을 때.** 소설 전문이 시험지에 실리는 일은
 *    드물어서 같은 「동백꽃」이라도 **학교마다 실린 대목이 다르다.** 문항만 죽 늘어놓으면
 *    어느 대목에 딸린 문항인지 알 수 없으므로, 지문(발췌)을 머리로 세우고 그 아래 문항을
 *    붙인다. 그 화면의 조회는 이미 지문 순서라(`fetchProblemPage` 의 work_title 분기)
 *    떨어진 같은 지문이 나올 일이 없다.
 *
 *  · `groupByPassageInPlace` — **그 밖의 모든 조건에서.** 같은 지문은 똑같이 한 상자로 모으되,
 *    지문 없는 문항을 **제자리에** 둔다(기본 목록은 지문 없는 문항이 대부분일 때가 많다).
 *
 * 둘 다 **문항을 다시 정렬하지 않는다** — 묶음 안의 차례도, 묶음끼리의 차례(처음 나온 자리)도
 * 조회 순서 그대로다.
 */

/** 지문 하나와 그 아래 문항들 */
export interface PassageGroup<T> {
  /** 지문 id. 지문이 없는 문항 묶음은 null */
  passageId: string | null;
  rows: T[];
}

/**
 * 행들을 지문별로 묶는다.
 *
 * 지문이 없는 문항은 **맨 뒤에 하나로** 모은다 — 사이사이에 흩어 두면 '지문 없는 문항'
 * 머리가 여러 번 나온다.
 * @param rows - 목록 행 (조회 순서 그대로)
 * @returns 등장 순서대로의 묶음
 */
export function groupRowsByPassage<T extends { passage_id: string | null }>(
  rows: readonly T[],
): PassageGroup<T>[] {
  const groups: PassageGroup<T>[] = [];
  const byId = new Map<string, PassageGroup<T>>();
  const orphans: T[] = [];

  for (const row of rows) {
    if (!row.passage_id) {
      orphans.push(row);
      continue;
    }
    const existing = byId.get(row.passage_id);
    if (existing) {
      existing.rows.push(row);
      continue;
    }
    const group: PassageGroup<T> = { passageId: row.passage_id, rows: [row] };
    byId.set(row.passage_id, group);
    groups.push(group);
  }

  if (orphans.length > 0) groups.push({ passageId: null, rows: orphans });
  return groups;
}

/**
 * 같은 지문을 **처음 나온 자리로 모아** 묶는다 (순수 함수).
 *
 * `groupRowsByPassage` 와 다른 점은 **지문 없는 문항의 자리**뿐이다 — 이쪽은 제자리에 한 줄씩
 * 둔다(`rows` 하나짜리 `passageId: null` 묶음). 맨 뒤로 모으면 등장 순서가 흐트러지는데,
 * 기본 목록은 문법 문항처럼 지문 없는 문항이 대부분일 때가 많다. 화면은 그 묶음을 머리 없이
 * 카드만 그린다.
 *
 * ⚠️ **떨어져 있어도 같은 지문은 한 상자로 모은다.** 기본 정렬은 시험지에 실린 차례를 따르므로
 *    대개 이웃하지만, 옛 출처(저장 시각이 묶음마다 다르다)나 조건에 걸린 문항이 드문드문일 때
 *    떨어질 수 있다 — 그때 상자를 둘로 두면 **같은 지문 머리가 두 번 나오고**, 묶음째 담기가
 *    그 지문의 일부만 담는 것처럼 보인다(코덱스 정지 리뷰).
 * @param rows - 목록 행 (조회 순서 그대로)
 * @returns 처음 나온 순서대로의 묶음
 */
export function groupByPassageInPlace<T extends { passage_id: string | null }>(
  rows: readonly T[],
): PassageGroup<T>[] {
  const groups: PassageGroup<T>[] = [];
  const byId = new Map<string, PassageGroup<T>>();

  for (const row of rows) {
    if (!row.passage_id) {
      // 지문이 없으면 이어 붙이지 않는다 — 서로 무관한 단독 문항들이다
      groups.push({ passageId: null, rows: [row] });
      continue;
    }
    const existing = byId.get(row.passage_id);
    if (existing) {
      existing.rows.push(row);
      continue;
    }
    const group: PassageGroup<T> = { passageId: row.passage_id, rows: [row] };
    byId.set(row.passage_id, group);
    groups.push(group);
  }

  return groups;
}

/** 고른 작품만 묻는 문항과, 다른 작품까지 함께 묻는 문항 */
export interface WorkSpanSplit<T> {
  /** 고른 작품 하나만 묻는 문항들 */
  only: T[];
  /** 고른 작품을 **다른 작품과 함께** 묻는 문항들 */
  shared: T[];
}

/**
 * 묶음 안의 문항을 **엮인 작품 수**로 가른다 (순수 함수).
 *
 * `(가) 진달래꽃 / (나) 엄마 걱정` 지문에서 `(가)와 (나)의 공통점은?` 같은 문항은 두 작품을
 * 함께 묻는다. '진달래꽃' 으로 훑을 때 그런 문항이 나머지와 섞여 있으면, 진달래꽃 하나만
 * 가르치는 자리에 쓸 수 없는 문항을 골라 담게 된다 — 그래서 따로 세워 준다.
 *
 * ⚠️ 고른 작품이 없으면(작품 조건이 아닐 때) 가르지 않는다 — 기준이 없으면 '함께 묻는' 이
 *    무슨 뜻인지 정할 수 없다.
 * @param rows - 한 지문 묶음의 문항들
 * @param workTitle - 지금 훑고 있는 작품명
 * @returns 가른 두 묶음 (등장 순서는 그대로)
 */
export function splitByWorkSpan<T extends { work_titles?: string[] | null }>(
  rows: readonly T[],
  workTitle: string,
): WorkSpanSplit<T> {
  if (!workTitle) return { only: [...rows], shared: [] };
  const only: T[] = [];
  const shared: T[] = [];
  for (const row of rows) {
    const titles = row.work_titles ?? [];
    // 고른 작품 말고 다른 작품이 붙어 있으면 '함께 묻는' 문항이다.
    // 작품명이 아예 없는 문항(지문에 작품이 없다)은 가를 근거가 없어 그대로 둔다
    if (titles.length > 1 && titles.includes(workTitle)) shared.push(row);
    else only.push(row);
  }
  return { only, shared };
}
