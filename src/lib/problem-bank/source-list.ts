import { supabase } from '@/lib/supabase';
import { sourceRefetchChunks } from './source-delete';
import type { ProblemSource } from '@/types/problem-bank';

/**
 * 출처 **목록** 조회와, 지우기 전에 세는 것들.
 *
 * `queries.ts` 에서 떼어 낸 이유는 길이도 있지만 규약이 달라서다 — 이쪽은 출처를 지울 수
 * 있게 되면서 **offset 이 움직이는 목록**이 되었고, 그래서 아래 `refetchSources` 같은
 * 다시 읽기 장치가 필요하다. 출처 **한 건**을 읽는 `fetchSource` 는 그대로 `queries.ts`
 * 에 있다(검수·문항 수정 화면이 쓴다).
 */

/** 한 화면에 보여 줄 출처 수 */
export const SOURCE_PAGE_SIZE = 30;

/**
 * 한 번의 요청으로 받을 쪽 수 상한.
 *
 * ⚠️ PostgREST 는 기본 1,000행에서 **말없이** 자른다. 펼쳐 둔 범위를 한 번에 달라고 하면
 *    34쪽(1,020행)부터 20행이 조용히 빠지고, 그 뒤 '더 보기' 는 1,020 부터 이어 받아
 *    빠진 20행이 영영 안 보인다. 그래서 상한 아래로 나눠 받는다.
 */
const MAX_PAGES_PER_REQUEST = Math.floor(1000 / SOURCE_PAGE_SIZE);

/** 출처 목록 한 페이지 */
export interface SourcePage {
  rows: ProblemSource[];
  /** 전체 개수 — '더 보기'를 보일지 판단한다 */
  total: number;
}

/**
 * 출처 목록.
 *
 * ⚠️ 상한만 걸고 자르면 안 된다 — 업로드가 쌓이면 **옛 출처가 목록에서 사라지고**
 *    검수를 못 끝낸 것도 함께 묻힌다(코덱스 리뷰 4R). 총 개수를 함께 돌려준다.
 * @param opts - 상태 필터, 페이지(0-based), 한 번에 받을 쪽 수(기본 1, 상한까지 잘린다)
 * @returns 행과 전체 개수
 */
export async function fetchSources(
  opts: { status?: string; page?: number; pageCount?: number } = {},
): Promise<SourcePage> {
  const page = Math.max(0, opts.page ?? 0);
  const span = Math.min(MAX_PAGES_PER_REQUEST, Math.max(1, Math.floor(opts.pageCount ?? 1)));
  const from = page * SOURCE_PAGE_SIZE;

  let query = supabase
    .from('problem_sources')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    // 같은 이유로 안정적인 2차 정렬 키를 둔다(queries.ts 의 fetchProblemPage 주석 참조)
    .order('id', { ascending: false })
    .range(from, from + SOURCE_PAGE_SIZE * span - 1);
  if (opts.status) query = query.eq('status', opts.status);

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: (data ?? []) as ProblemSource[], total: count ?? 0 };
}

/**
 * 펼쳐 둔 범위를 **0쪽부터 통째로** 다시 읽는다 (출처를 지운 뒤).
 *
 * 지운 뒤에 지역 목록에서 행만 빼면 안 된다 — 한 행이 사라지면 DB 쪽 offset 이 통째로
 * 하나씩 당겨져서, 이어서 다음 쪽을 받을 때 **경계에 걸린 행 하나가 영영 안 보인다**
 * (중복보다 나쁘다. 그 출처가 지워진 줄 안다).
 * @param pageCount - 지금까지 펼친 쪽 수
 * @returns 그 범위의 행 전부와 전체 개수
 * @throws 조회 실패 시 (호출부는 목록을 '다시 읽어야 하는 상태' 로 두어야 한다)
 */
export async function refetchSources(pageCount: number): Promise<SourcePage> {
  const rows: ProblemSource[] = [];
  let total = 0;

  for (const { page, span } of sourceRefetchChunks(pageCount, MAX_PAGES_PER_REQUEST)) {
    const chunk = await fetchSources({ page, pageCount: span });
    rows.push(...chunk.rows);
    total = chunk.total;
    // 요청한 것보다 적게 왔으면 끝까지 읽은 것이다 — 더 물어도 빈 응답만 온다
    if (chunk.rows.length < SOURCE_PAGE_SIZE * span) break;
  }
  return { rows, total };
}

/**
 * 이 출처의 문항 수 — 지우기 전 확인창에 적는다.
 *
 * 행을 받지 않고 **세기만** 한다(`head: true`). 확인창 숫자 하나 때문에 한 출처의
 * 본문을 전부 내려받을 이유가 없고, 세는 것이라 1,000행 상한에도 걸리지 않는다.
 * @param sourceId - 출처 id
 * @returns 문항 수
 * @throws 조회 실패 시
 */
export async function countSourceProblems(sourceId: string): Promise<number> {
  const { count, error } = await supabase
    .from('problems')
    .select('id', { count: 'exact', head: true })
    .eq('source_id', sourceId);
  if (error) throw error;
  return count ?? 0;
}

/**
 * 이 출처의 문항 id — `countPapersUsing` 이 문항 id 를 받으므로 그 앞에 쓴다.
 *
 * 확인창의 '문제지 N개' 는 **안심시키려는 말**이라(문제지는 스냅샷이라 그대로 인쇄된다)
 * 정확한 집계가 아니어도 된다. 그래서 1,000개에서 끊는다 — 문항 수 자체는 위
 * `countSourceProblems` 가 정확히 센다.
 * @param sourceId - 출처 id
 * @returns 문항 id 들 (최대 1,000개)
 * @throws 조회 실패 시
 */
export async function fetchSourceProblemIds(sourceId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('problems')
    .select('id')
    .eq('source_id', sourceId)
    .limit(1000);
  if (error) throw error;
  return (data ?? []).map((r) => (r as { id: string }).id);
}
