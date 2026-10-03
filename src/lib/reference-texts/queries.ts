import { supabase } from '@/lib/supabase';
import { pgArrayLiteral } from '@/lib/pg-array-literal';
import { escapeIlike } from '@/lib/problem-bank/queries';
import type { ReferenceText, ReferenceTextListItem } from '@/types/reference-text';
import { REFERENCE_TEXT_LIST_LIMIT, REFERENCE_TEXT_PICK_LIMIT } from './constants';
import type { ReferenceTextQuery } from './filters';

/**
 * 작품 전문 조회 (sql/30).
 *
 * ⚠️ 목록에서 `body` 를 읽지 않는다 — 전문 한 편이 수만 자라 서른 줄만 받아도 응답이
 *    감당이 안 된다. 본문은 편집기·참고자료가 **고른 것만** 따로 읽는다
 *    (`passage-search.ts` ↔ `detail-queries.ts` 와 같은 규약).
 */

// ⚠️ 한 줄로 둘 것 — `+` 로 이으면 리터럴 타입이 string 으로 넓어져 PostgREST 의 행 타입
//    추론이 통째로 풀린다. `ReferenceTextListItem` 과 **1:1** 로 맞춰 둘 것
export const REFERENCE_TEXT_LIST_COLUMNS = 'id,title,author,char_count,units,grammar_paths,note,user_id,updated_by,created_at,updated_at';

/** 조건을 걸 수 있는 요청 — PostgREST 필터 빌더의 필요한 부분만(`applySourceAxes` 와 같은 규약) */
interface ReferenceQueryFilterable<T> {
  eq(column: string, value: string): T;
  contains(column: string, value: string): T;
  overlaps(column: string, value: string): T;
}

/**
 * 왼쪽 패널의 축 조건을 건다 — 목록과 검색이 **이 한 곳**을 탄다.
 *
 * ⚠️ 단원(jsonb)은 **JSON 문자열**로 넘긴다. postgrest-js 의 `contains` 는 문자열이면
 *    `cs.` 뒤에 그대로 싣고, 배열이면 따옴표 없이 이어 붙인다 — 배열을 주면 쉼표 든 단원
 *    이름(`1. 나를 깨우는, 문학`)이 쪼개져 0건이 된다(2026-09-27 의 그 문제).
 * ⚠️ 문법 배열은 `pgArrayLiteral` 로 넘긴다(같은 이유). 상위 검색이라 `&&` 다(sql/21).
 * ⚠️ '분류 없음' 은 빈 값과의 같음이다(`units=eq.[]`, `grammar_paths=eq.{}`).
 * @param request - 필터 빌더
 * @param query - 조건 (`toReferenceTextQuery` 가 만든 값)
 * @returns 조건을 건 빌더
 */
export function applyReferenceQuery<T extends ReferenceQueryFilterable<T>>(
  request: T, query: ReferenceTextQuery,
): T {
  let next = request;
  if (query.unit) next = next.contains('units', JSON.stringify([query.unit]));
  if (query.unitsEmpty) next = next.eq('units', '[]');
  if (query.title !== undefined) next = next.eq('title', query.title);
  if (query.grammar_paths && query.grammar_paths.length > 0) {
    next = next.overlaps('grammar_paths', pgArrayLiteral(query.grammar_paths));
  }
  if (query.grammarEmpty) next = next.eq('grammar_paths', '{}');
  return next;
}

/**
 * 전문 목록 (최근 고친 것부터).
 * @param limit - 최대 줄 수
 * @param query - 왼쪽 패널의 축 조건 (없으면 전체)
 * @returns 목록 (본문은 빠져 있다)
 * @throws 조회 실패 시
 */
export async function fetchReferenceTextList(
  limit: number = REFERENCE_TEXT_LIST_LIMIT,
  query: ReferenceTextQuery = {},
): Promise<ReferenceTextListItem[]> {
  const request = supabase
    .from('reference_texts')
    .select(REFERENCE_TEXT_LIST_COLUMNS);
  const { data, error } = await applyReferenceQuery(request, query)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ReferenceTextListItem[];
}

/**
 * 전문 하나를 본문까지 읽는다.
 * @param id - 전문 id
 * @returns 전문. 없으면 null
 * @throws 조회 실패 시
 */
export async function fetchReferenceText(id: string): Promise<ReferenceText | null> {
  const { data, error } = await supabase
    .from('reference_texts')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as ReferenceText | null) ?? null;
}

/**
 * 제목이나 지은이로 전문을 찾는다 (본문 제외).
 *
 * ⚠️ `.or()` 를 쓰지 않는다 — 이스케이프가 인용을 통과하며 풀린다(`queries.ts` 와 같은 이유).
 *    부르는 쪽이 칸마다 따로 물어 합친다.
 * @param term - 검색어 (빈 값이면 아무것도 찾지 않는다)
 * @param field - 어느 칸을 볼 것인가
 * @param limit - 최대 줄 수
 * @param query - 왼쪽 패널의 축 조건 — 검색어와 **함께** 걸린다 (없으면 전체)
 * @returns 목록
 * @throws 조회 실패 시
 */
export async function searchReferenceTexts(
  term: string,
  field: 'title' | 'author',
  limit: number = REFERENCE_TEXT_PICK_LIMIT,
  query: ReferenceTextQuery = {},
): Promise<ReferenceTextListItem[]> {
  const keyword = term.trim();
  if (keyword === '') return [];
  const request = supabase
    .from('reference_texts')
    .select(REFERENCE_TEXT_LIST_COLUMNS)
    .ilike(field, `%${escapeIlike(keyword)}%`);
  const { data, error } = await applyReferenceQuery(request, query)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ReferenceTextListItem[];
}

/**
 * 최근에 고친 전문 몇 건 (검색어 없이 고르기 창을 열었을 때).
 * @param limit - 최대 줄 수
 * @returns 목록
 * @throws 조회 실패 시
 */
export function fetchRecentReferenceTexts(
  limit: number = REFERENCE_TEXT_PICK_LIMIT,
): Promise<ReferenceTextListItem[]> {
  return fetchReferenceTextList(limit);
}

/**
 * 전문 여러 건의 **본문만** 읽는다 (참고자료로 붙일 때).
 * @param ids - 전문 id 들
 * @returns id → 본문 지도 (없는 id 는 빠진다)
 * @throws 조회 실패 시
 */
export async function fetchReferenceBodies(ids: readonly string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase
    .from('reference_texts')
    .select('id, body')
    .in('id', unique);
  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.id as string, (row.body as string) ?? '']));
}
