import { supabase } from '@/lib/supabase';
import type { TypeMixRow } from '@/lib/problem-paper/type-mix';
import {
  PROBLEM_LIST_SELECT, runProblemQuery,
  type ProblemQuery, type ProblemRow, type QueryPage,
} from './queries';

/**
 * **유형 비율로 담기** 의 조회 두 가지.
 *
 * 목록 조회(`queries.ts`)와 갈라 둔 까닭은 읽는 양이다 — 비율을 따지려면 조건에 걸린
 * 문항을 **전부** 봐야 하는데(최대 1,000행), 그 행마다 본문 HTML 을 실으면 응답이
 * 몇 메가바이트가 된다. 그래서 두 걸음으로 나눈다:
 *  1. **가벼운 풀** — 갈래를 가릴 최소 컬럼(id·지문·유형)만 전부 읽는다.
 *  2. **id 로 되읽기** — 뽑힌 문항(최대 200개)만 목록 컬럼까지 읽어 담는다.
 *
 * ⚠️ 필터 체인은 `queries.ts` 의 `runProblemQuery` **한 벌**뿐이다 — 여기서 베끼지 말 것.
 */

/**
 * 풀에서 읽을 컬럼.
 *
 * ⚠️ `source:problem_sources!inner(id)` 임베드를 반드시 남긴다 — 출처 축 필터
 *    (`source.school_name` 등)가 그 별칭을 타므로, 빼면 요청이 통째로 거부된다.
 *    한 줄이어야 행 타입 추론이 풀리지 않는다.
 */
const TYPE_MIX_POOL_SELECT = 'id, passage_id, question_type, source:problem_sources!inner(id)';

/**
 * `.in('id', …)` 한 번에 넣을 id 수.
 *
 * UUID 100개면 주소가 4KB 안팎이라 프록시의 URL 길이 상한 아래다. 문제지 상한이 200이므로
 * 실제로는 두 번이면 끝난다.
 */
export const PROBLEM_ID_CHUNK = 100;

/**
 * 지금 조건에 걸린 문항의 **가벼운 풀**을 읽는 순서로 가져온다.
 *
 * 차례가 읽는 순서인 것이 계약이다 — 뽑기(`sampleTypeMix`)가 그 차례로 지문 묶음을 만들고,
 * 고른 것을 그 차례로 되돌려 같은 지문의 문항이 붙게 한다.
 * @param query - 필터
 * @param limit - 받아 올 최대 행 수 (`TYPE_MIX_POOL_MAX`)
 * @returns 가벼운 행과 **조건에 걸린 전체 개수**(받아 온 행보다 클 수 있다 — 그때는
 *          목록이 잘린 것이라 부르는 쪽이 막는다)
 */
export async function fetchTypeMixPool(
  query: ProblemQuery, limit: number,
): Promise<QueryPage<TypeMixRow>> {
  if (limit < 1) return { rows: [], total: 0 };
  return runProblemQuery<TypeMixRow>(query, 'reading', 0, limit - 1, TYPE_MIX_POOL_SELECT);
}

/**
 * 뽑힌 문항을 **id 로** 담기용 전체 행까지 읽는다.
 *
 * ⚠️ 돌려주는 차례는 **넘긴 id 차례 그대로**다. 청크를 나눠 조회하므로 DB 가 주는 차례에
 *    맡기면 청크 경계에서 순서가 뒤집혀 같은 지문의 문항이 떨어진다 — 그러면 저장할 때
 *    '같은 지문의 문항이 떨어져 있다' 로 막힌다.
 * @param ids - 담을 문항 id (읽는 순서)
 * @returns 그 차례의 행 (없는 id 는 빠진다)
 */
export async function fetchProblemsByIdsForAdd(ids: readonly string[]): Promise<ProblemRow[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];

  const chunks: string[][] = [];
  for (let from = 0; from < unique.length; from += PROBLEM_ID_CHUNK) {
    chunks.push(unique.slice(from, from + PROBLEM_ID_CHUNK));
  }

  const pages = await Promise.all(chunks.map(async (chunk) => {
    const { data, error } = await supabase
      .from('problems')
      .select(PROBLEM_LIST_SELECT)
      .in('id', chunk);
    if (error) throw error;
    return (data ?? []) as unknown as ProblemRow[];
  }));

  const rank = new Map(unique.map((id, index) => [id, index]));
  return pages.flat().sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
}
