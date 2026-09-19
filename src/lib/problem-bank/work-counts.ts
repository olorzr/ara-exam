import type { PassageWork } from '@/types/problem-bank';
import type { WorkFacet } from './facets';

/**
 * 작품별 문항 수 세기 (순수 함수).
 *
 * 조회는 `facets.ts` 가 하고 여기서는 읽어 온 행들을 세기만 한다 — supabase 를 흉내 내지 않고
 * 규칙만 테스트할 수 있게 가른다(`grammar-counts.ts` 와 같은 규약).
 *
 * ⚠️ 한 문항이 작품 **여럿**에 걸린다(`(가)와 (나)의 공통점은?`). 그래서 문항 수의 합은
 *    문항 개수보다 크다 — 트리의 `(n)` 은 '그 작품을 고르면 나오는 문항 수' 이고,
 *    그 조회가 `contains` 라 같은 문항이 두 작품 아래 나오는 것이 맞다.
 */

/**
 * 문항별 작품명 목록에서 작품마다 문항 수를 센다.
 * @param rows - 문항별 `work_titles`
 * @returns 작품명 → 문항 수
 */
export function tallyWorkCounts(rows: readonly (readonly string[])[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const titles of rows) {
    // 한 문항 안에 같은 제목이 두 번 들어 있어도 한 번만 센다(DB 가 막지만 옛 행이 있다)
    for (const title of new Set(titles)) {
      if (!title) continue;
      counts.set(title, (counts.get(title) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * 지문들의 작품에서 **제목 → 지은이**를 모은다.
 *
 * 작품 트리가 `지은이 › 작품` 두 단이라 문항 쪽 지은이를 제목으로 되찾아야 한다.
 * 같은 제목에 지은이가 여럿이면(표기가 갈렸거나 동명이작) **가장 많이 쓰인 이름**을 고른다.
 * @param rows - 지문별 작품 목록
 * @returns 제목 → 지은이
 */
export function collectWorkAuthors(
  rows: readonly (readonly PassageWork[])[],
): Map<string, string> {
  const tally = new Map<string, Map<string, number>>();
  for (const works of rows) {
    for (const work of works) {
      if (!work.title || !work.author) continue;
      const byAuthor = tally.get(work.title) ?? new Map<string, number>();
      byAuthor.set(work.author, (byAuthor.get(work.author) ?? 0) + 1);
      tally.set(work.title, byAuthor);
    }
  }

  const out = new Map<string, string>();
  for (const [title, byAuthor] of tally) {
    const best = [...byAuthor.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best) out.set(title, best[0]);
  }
  return out;
}

/**
 * 센 결과를 트리·선택지가 쓰는 모양으로.
 * @param counts - 작품명 → 문항 수
 * @param authors - 작품명 → 지은이
 * @returns 작품 목록 (제목 한글 사전순)
 */
export function toWorkFacets(
  counts: ReadonlyMap<string, number>,
  authors: ReadonlyMap<string, string>,
): WorkFacet[] {
  return [...counts.entries()]
    .map(([title, count]) => ({ title, author: authors.get(title) ?? '', count }))
    .sort((a, b) => a.title.localeCompare(b.title, 'ko'));
}
