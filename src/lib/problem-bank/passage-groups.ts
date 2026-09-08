/**
 * 목록을 **지문별로** 묶는다 (순수 함수).
 *
 * 작품으로 훑을 때 쓴다. 소설 전문이 시험지에 실리는 일은 드물어서, 같은 「동백꽃」이라도
 * 학교마다 **실린 대목이 다르다.** 문항만 죽 늘어놓으면 어느 대목에 딸린 문항인지 알 수
 * 없으므로, 지문(발췌)을 머리로 세우고 그 아래 문항을 붙인다.
 *
 * 조회가 이미 지문 순서로 정렬해 오므로(`fetchProblemPage` 의 work_title 분기)
 * 여기서는 **등장 순서를 그대로** 지키며 이웃끼리만 묶는다 — 다시 정렬하면 화면 순서와
 * 쪽 나누기가 어긋난다.
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
