import { supabase } from '@/lib/supabase';
import { publicDb } from '@/lib/supabase-public';
import { applyOwnerScope, type OwnerScope } from '@/lib/owner-scope';
import { escapeIlike } from '@/lib/problem-bank/query-chain';
import type { ProblemPaper } from '@/types/problem-bank';

/**
 * 문제지 목록 찾기 — 제목 · 만든 선생님 이름(서버에서, 200개 상한 밖도 찾는다).
 *
 * 원장님(2026-11-22): "다른 선생님이 만든 거는 좀 검색이 가능하게 하거나, 내 것도 검색이 가능하게".
 * ⚠️ **`.or()` 를 쓰지 않는다** — 이 저장소의 규약이다(query-chain.ts·passage-search.ts: 이스케이프가 `.or()` 인용을
 *    지나며 풀린다). 제목 조회와 '이름이 맞는 선생님' 조회를 **따로 물어 id 로 합친다**(`searchPassages` 와 같은 수).
 *    `ilike`·`in` 은 단일 필터라 값이 URL 인코딩되어 괄호·쉼표가 문법이 되지 않고, `escapeIlike` 가 `% _ \` 를 막는다.
 * ⚠️ 선생님 이름은 `public.profiles` 에서 읽는다(재직 교직원에게만 열려 있다 — 퇴직 선생님 이름으로는 못 찾는다).
 *    이름 조회가 실패해도 제목으로는 찾는다(creator-names.ts 와 같은 규약 — 이름은 곁가지).
 */

/** 한 번에 보여 줄 문제지 수 — `paper-list.ts` 의 목록과 같다(그쪽이 다시 내보낸다) */
export const PAPER_SEARCH_LIMIT = 200;

/** 이름이 맞는 선생님을 이만큼까지만 본다 — 학원 직원 수보다 넉넉하다 */
export const CREATOR_MATCH_LIMIT = 50;

/** 이름 뒤에 붙여 치기 쉬운 말 — '최지은 선생님' 으로 쳐도 찾는다 */
const TEACHER_SUFFIX = /\s*(?:선생님|쌤|샘)$/;

/**
 * 찾는 말을 선생님 이름 조회용으로 — 앞뒤 공백과 끝의 '선생님' 을 뗀다.
 * @param keyword - 찾는 말
 * @returns 이름 조회에 쓸 말(비면 이름으로는 찾지 않는다)
 */
export function creatorKeyword(keyword: string): string {
  return keyword.trim().replace(TEACHER_SUFFIX, '').trim();
}

/**
 * 이름이 찾는 말을 품은 선생님들의 id — 실패하면 조용히 빈 목록.
 * @param keyword - 찾는 말
 * @returns 선생님 id 들
 */
export async function findCreatorIdsByName(keyword: string): Promise<string[]> {
  const name = creatorKeyword(keyword);
  if (!name) return [];
  try {
    const { data, error } = await publicDb().from('profiles').select('id')
      .ilike('name', `%${escapeIlike(name)}%`).limit(CREATOR_MATCH_LIMIT);
    if (error) return [];
    return ((data ?? []) as { id: string }[]).map((row) => row.id);
  } catch {
    return [];
  }
}

/** 합칠 때 쓰는 칸 — 차례(만든 때·id)를 정한다 */
type Mergeable = Pick<ProblemPaper, 'id' | 'created_at'>;

/**
 * 두 조회의 결과를 합친다 — id 로 겹친 것을 없애고 목록과 같은 차례(최근 것부터, 같으면 id 내림차순)로 상한까지.
 * @param lists - 조회 결과들
 * @param limit - 상한
 * @returns 합친 목록
 */
export function mergePapers<T extends Mergeable>(lists: readonly (readonly T[])[], limit: number): T[] {
  const byId = new Map<string, T>();
  for (const list of lists) for (const paper of list) if (!byId.has(paper.id)) byId.set(paper.id, paper);
  return [...byId.values()]
    .sort((a, b) => (a.created_at === b.created_at ? (a.id < b.id ? 1 : -1) : a.created_at < b.created_at ? 1 : -1))
    .slice(0, limit);
}

/**
 * 제목이나 만든 선생님 이름으로 문제지를 찾는다 — 탭(내 것 / 다른 선생님 것) 안에서.
 * @param scope - 내 것 / 다른 선생님 것
 * @param userId - 로그인한 사람의 id
 * @param keyword - 찾는 말(비어 있으면 안 된다 — 부르는 쪽이 거른다)
 * @returns 찾은 문제지들(최근 것부터, 상한까지)
 * @throws 문제지 조회 실패 시
 */
export async function searchPapers(scope: OwnerScope, userId: string, keyword: string): Promise<ProblemPaper[]> {
  const creators = await findCreatorIdsByName(keyword);
  // 요청 빌더를 함수로 감싸 돌려주면 타입이 너무 깊어진다(TS2589) — paper-list.ts 처럼 그 자리에서 짓는다
  const titleRequest = supabase.from('problem_papers').select('*');
  const byTitle = applyOwnerScope(titleRequest, scope, userId)
    .ilike('title', `%${escapeIlike(keyword.trim())}%`)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(PAPER_SEARCH_LIMIT);
  const creatorRequest = supabase.from('problem_papers').select('*');
  const byCreator = creators.length > 0
    ? applyOwnerScope(creatorRequest, scope, userId).in('user_id', creators)
      .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(PAPER_SEARCH_LIMIT)
    : Promise.resolve({ data: [], error: null });
  const [title, creator] = await Promise.all([byTitle, byCreator]);
  if (title.error) throw title.error;
  if (creator.error) throw creator.error;
  const lists = [title.data, creator.data].map((data) => (data ?? []) as unknown as ProblemPaper[]);
  return mergePapers(lists, PAPER_SEARCH_LIMIT);
}
