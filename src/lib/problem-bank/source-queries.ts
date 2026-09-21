import { supabase } from '@/lib/supabase';
import type { Passage, Problem, ProblemSource } from '@/types/problem-bank';

/**
 * **한 출처를 통째로** 읽는 조회들 (검수 화면·문항 편집).
 *
 * 아카이브 목록(`queries.ts`)과 갈라 둔 까닭: 그쪽은 조건으로 걸러 **한 쪽씩** 읽고 컬럼을
 * 좁히지만, 여기는 한 출처의 지문·문항을 **빠짐없이** 읽는다(검수 화면이 돌려받은 배열을
 * 그 출처의 전부로 보고 개수를 세고 '검수 마치기' 까지 허용한다). 규약이 정반대라 한 파일에
 * 두면 어느 쪽 규칙인지 헷갈린다.
 */

/**
 * 출처 한 건.
 * @param id - 출처 id
 * @returns 출처. 없으면 null
 */
export async function fetchSource(id: string): Promise<ProblemSource | null> {
  const { data, error } = await supabase
    .from('problem_sources')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as ProblemSource) ?? null;
}

/** 한 출처의 상세를 읽을 때 한 번에 가져오는 행 수 (PostgREST 기본 상한) */
const DETAIL_CHUNK = 1000;

/** 한 출처가 가질 수 있다고 보는 최대 행 수 — 무한 루프 방지 안전판 */
const DETAIL_MAX_ROWS = 5000;

/**
 * 한 출처의 지문 전부.
 *
 * ⚠️ 상한을 걸고 자르면 안 된다 — 검수 화면은 돌려받은 배열을 **그 출처의 전부**로 보고
 *    개수를 세고 '검수 마치기'까지 허용한다. 잘린 부분은 아무도 못 보고 지나간다
 *    (코덱스 리뷰 7R). 끝까지 페이지를 넘겨 읽는다.
 * @param sourceId - 출처 id
 * @returns 쪽 순서 목록
 */
export async function fetchPassages(sourceId: string): Promise<Passage[]> {
  return fetchAllPages<Passage>((from, to) => supabase
    .from('passages')
    .select('*')
    .eq('source_id', sourceId)
    .order('page_no')
    .order('id')
    .range(from, to));
}

/**
 * 한 출처의 문항 전부 (검수 화면용 — 본문까지 전부 읽는다).
 * 지문과 같은 이유로 끝까지 읽는다.
 * @param sourceId - 출처 id
 * @returns 쪽·번호 순서 목록
 */
export async function fetchProblemsOfSource(sourceId: string): Promise<Problem[]> {
  return fetchAllPages<Problem>((from, to) => supabase
    .from('problems')
    .select('*')
    .eq('source_id', sourceId)
    .order('page_no')
    .order('number', { nullsFirst: false })
    .order('id')
    .range(from, to));
}

/**
 * 페이지를 넘겨 가며 전부 읽는다.
 * @param query - (from, to) 를 받아 한 페이지를 조회하는 함수
 * @returns 모든 행
 * @throws 조회 실패 시 — 검수 화면은 부분 목록을 전부로 오해하면 안 되므로 삼키지 않는다
 */
async function fetchAllPages<T>(
  query: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < DETAIL_MAX_ROWS; from += DETAIL_CHUNK) {
    const { data, error } = await query(from, from + DETAIL_CHUNK - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < DETAIL_CHUNK) break;
  }
  return out;
}

/**
 * 문항 한 건 (편집 화면용).
 * @param id - 문항 id
 * @returns 문항. 없으면 null
 */
export async function fetchProblem(id: string): Promise<Problem | null> {
  const { data, error } = await supabase
    .from('problems')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as Problem) ?? null;
}

/** 아카이브 목록 한 페이지 */
