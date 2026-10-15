import { supabase } from '@/lib/supabase';
import type { SourceAxisQuery } from './source-axes';
import { ARCHIVE_LIST_RPC, splitArchiveRpc } from './archive-rpc';
import {
  applyProblemFilters, applyProblemOrder, withOrderColumns, type ProblemChain, type ProblemOrder,
} from './query-chain';
import type { Problem, ProblemSource, QuestionType } from '@/types/problem-bank';

// 여러 모듈이 이 자리에서 가져간다(passage-search·source-list·quiz-references·reference-texts)
export { escapeIlike } from './query-chain';
export type { ProblemOrder } from './query-chain';

/**
 * 기출 아카이브 **목록** 조회.
 *
 * ⚠️ PostgREST 는 기본 1,000행에서 잘린다. 목록은 **반드시 `.range()` 로 페이지**를 나누고
 *    총 개수는 `count: 'exact'` 로 따로 받는다(조용히 잘린 목록이 '전부'로 보이면 안 된다).
 *
 * 한 출처를 통째로 읽는 조회(검수 화면)는 `source-queries.ts` 로 갈라 두었다 — 그쪽은
 * **빠짐없이** 읽는 것이 계약이라 규약이 정반대다.
 */

/** 목록에 필요한 컬럼만 — 본문 HTML 은 무겁다 */
const PROBLEM_LIST_COLUMNS =
  'id, source_id, passage_id, number, question_type, stem_html, choices, answer, '
  + 'area_path, unit_path, grammar_paths, work_titles, work_title, page_no, image_path, '
  + 'render_mode, status, created_at';

/**
 * 목록·담기 조회가 함께 쓰는 select 문자열.
 *
 * ⚠️ 임베드 별칭(`source:`)은 어떤 select 를 쓰든 **반드시 남긴다** — 출처 축 필터
 *    (`source.year` 등)가 그 별칭을 타므로, 빼면 PostgREST 가 요청을 통째로 거부한다.
 * ⚠️ **한 줄이어야 한다** — `+` 로 이으면 리터럴 타입이 `string` 으로 넓어져 행 타입
 *    추론이 풀린다(이 저장소의 오랜 규약).
 */
export const PROBLEM_LIST_SELECT = `${PROBLEM_LIST_COLUMNS}, source:problem_sources!inner(*)`;

/** 한 화면에 보여 줄 문항 수 */
export const PROBLEM_PAGE_SIZE = 60;

// 출처를 다루는 조회는 이 파일에 없다 — 셋으로 갈려 있다:
//  · `source-list.ts` — 출처 **목록**(`SOURCE_PAGE_SIZE`·`fetchSources`·`refetchSources`).
//    출처를 지울 수 있게 되면서 offset 이 움직이는 목록이 되어 규약이 달라졌다.
//  · `source-queries.ts` — 출처 **한 건**과 그 지문·문항 전부(`fetchSource`·`fetchPassages`·
//    `fetchProblemsOfSource`·`fetchProblem`). 검수 화면이 쓰고, 빠짐없이 읽는 것이 계약이다.
//  · 여기는 **아카이브 목록**뿐이다 — 조건으로 걸러 한 쪽씩, 컬럼을 좁혀 읽는다.

/** 조회 결과 한 구간 — 행 모양은 넘긴 select 에 따라 다르다 */
export interface QueryPage<Row> {
  rows: Row[];
  /** 필터에 걸린 전체 개수 (페이지 수 계산용) */
  total: number;
}

/** 목록 컬럼을 다 읽은 행 */
export type ProblemRow = Problem & { source: ProblemSource };

/** 목록 조회 결과 */
export type ProblemPage = QueryPage<ProblemRow>;

/**
 * 목록 조회 조건. 출처 칸(유형·학교·학년도·학년·학기·시험·교과서·학교급)은 `SourceAxisQuery`
 * (source-axes.ts) 에서 물려받는다 — 올라간 기출 목록과 같은 규칙을 쓴다.
 */
export interface ProblemQuery extends SourceAxisQuery {
  /** 영역 이름 경로 — 배열 포함(@>) 으로 찾는다 */
  area_path?: string[];
  /** 교과서 단원 경로 — 대단원만 주면 그 아래 소단원 문항까지 걸린다 */
  unit_path?: string[];
  /**
   * 문법 분류 — **찾을 경로 문자열들**(하나라도 걸리면 통과, `&&`).
   * 상위를 골랐을 때 그 마디와 아래 경로로 펴는 일은 `filters.ts` 가 이미 끝내고 넘긴다.
   */
  grammar_paths?: string[];
  /**
   * 작품명 **한 편**. 이 조건이 걸리면 목록이 **지문 순서**로 정렬된다.
   * ⚠️ 문항은 작품을 여럿 들 수 있어(`work_titles`) **배열 포함**으로 찾는다 —
   *    `(가)(나)` 를 함께 묻는 문항도 두 작품 어느 쪽으로 훑어도 나온다.
   */
  work_title?: string;
  /**
   * 작품 **그 하나만** 묻는 문항으로 좁힌다 — `work_titles` 가 `{작품}` 과 **정확히 같은** 행만.
   * (가)(나) 를 함께 묻는 문항은 목록이 둘이라 빠지고, 복합 지문이어도 발문이 한 작품만
   * 묻는 문항은 남는다(사용자 결정 2026-10-11). `work_title` 이 없으면 아무 뜻이 없다.
   */
  only_work?: boolean;
  /**
   * **딸린 지문**의 대영역 — 하나라도 맞으면 걸린다(`in`). `''` 은 지문이 없거나 영역이 빈 문항.
   * ⚠️ 문항의 `area_path` 가 아니다(그것은 그 물음의 영역이다). sql/67 의 복제 컬럼
   *    `passage_area` 를 본다 — 무엇을 넣을지는 `solo-filter.ts` 가 정한다.
   */
  passage_areas?: string[];
  /**
   * 문항 유형 — **하나라도 맞으면** 걸린다(`in`).
   * 갈래('주관식')를 저장값 둘('주관식'·'서술형')로 펴는 일은 `filters.ts` 가 끝내고 넘긴다.
   */
  question_types?: QuestionType[];
  /** 발문·선지·작품명 평문 검색 */
  search?: string;
  page?: number;
}

/** 조회 응답에서 쓰는 칸 — 표·함수 출발점 둘 다 이 모양으로 끝난다 */
interface ChainResponse {
  data: unknown;
  error: unknown;
  count: number | null;
}

/**
 * 조건에 맞는 문항을 한 구간 읽는다.
 *
 * ⚠️ 필터 체인은 `query-chain.ts` **한 벌**뿐이어야 한다. 조회 함수마다 베끼면 언젠가 한쪽만 고쳐져
 *    "목록에는 보이는데 담기에는 안 걸리는" 문항이 생긴다. 그래서 형제 조회 모듈(`type-mix-queries.ts`)도
 *    select 만 바꿔 **이 함수를 부른다** — 체인을 베끼지 말 것.
 * ⚠️ **출발점이 둘이다**(archive-rpc.ts). 작품·문법 축이 걸리면 GIN 을 타는 함수(sql/72)에서 출발하고,
 *    그 함수가 거른 칸(작품·문법·출처)을 뺀 나머지 조건을 같은 체인에 건다. 아니면 문항 표에서 출발한다.
 *    영역·단원·검색은 어느 쪽이든 순차 스캔이다(RLS 아래 leakproof 제약, sql/66 머리말).
 * @param query - 필터
 * @param order - 늘어놓을 순서
 * @param from - 첫 행 (0부터)
 * @param to - 마지막 행 (포함)
 * @param select - 읽을 컬럼. 기본은 목록 컬럼 전부 (`source:` 임베드는 반드시 남길 것)
 * @returns 행과 조건에 걸린 전체 개수
 */
export async function runProblemQuery<Row = ProblemRow>(
  query: ProblemQuery, order: ProblemOrder, from: number, to: number,
  select: string = PROBLEM_LIST_SELECT,
): Promise<QueryPage<Row>> {
  const split = splitArchiveRpc(query);
  if (split) {
    // 함수 결과는 select 에 없는 칸으로 정렬하지 못한다(query-chain.ts 의 withOrderColumns)
    const fromRpc = supabase
      .rpc(ARCHIVE_LIST_RPC, split.args, { count: 'exact' })
      .select(withOrderColumns(select, order));
    return finishProblemQuery<Row, typeof fromRpc>(fromRpc, split.rest, order, from, to);
  }
  const fromTable = supabase
    .from('problems')
    .select(select, { count: 'exact' });
  return finishProblemQuery<Row, typeof fromTable>(fromTable, query, order, from, to);
}

/**
 * 출발점에 정렬·쪽·조건을 걸고 읽는다.
 * @param base - 표 또는 함수에서 출발한 빌더
 * @param query - 체인에 걸 조건
 * @param order - 늘어놓을 순서
 * @param from - 첫 행
 * @param to - 마지막 행
 * @returns 행과 전체 개수
 */
async function finishProblemQuery<Row, T extends ProblemChain<T> & PromiseLike<ChainResponse>>(
  base: T, query: ProblemQuery, order: ProblemOrder, from: number, to: number,
): Promise<QueryPage<Row>> {
  const request = applyProblemFilters(applyProblemOrder(base, order).range(from, to), query);
  const { data, error, count } = await request;
  if (error) throw error;
  return { rows: (data ?? []) as Row[], total: count ?? 0 };
}

/**
 * 아카이브 목록을 한 페이지 가져온다.
 * @param query - 필터
 * @returns 행과 전체 개수
 */
export async function fetchProblemPage(query: ProblemQuery): Promise<ProblemPage> {
  const page = Math.max(0, query.page ?? 0);
  const from = page * PROBLEM_PAGE_SIZE;
  // 작품으로 볼 때만 지문 순서다 — 그 화면이 지문별로 묶어 그린다.
  // ⚠️ 여기는 `!== undefined`, 조건 걸기는 truthy 다(위 `runProblemQuery`). 일부러 다르다 —
  //    빈 작품명은 거르지 않지만(자유 텍스트 축에 '미지정만' 이 없다) 정렬은 작품 화면의 것을 쓴다
  const order: ProblemOrder = query.work_title !== undefined ? 'reading' : 'recent';
  return runProblemQuery(query, order, from, from + PROBLEM_PAGE_SIZE - 1);
}

/**
 * **한 지문에 딸린 문항 전부**를 문제지에 담으려고 가져온다.
 *
 * 목록에 보이는 행만 담지 않는 까닭: 그 지문의 문항이 **조건에 안 걸렸거나**(문법 태그로
 * 좁혔다), **다음 쪽에 있거나**(한 쪽은 60개다), 옛 출처라 저장 시각이 갈려 멀리 떨어져
 * 있을 수 있다. 그때 보이는 것만 담으면 '이 지문 담기' 라고 해 놓고 **그 지문의 일부만**
 * 담는다 — 상세 창의 '이 지문의 문항 N개 담기' 가 형제 전부를 담는 것과 같은 규약이다
 * (코덱스 정지 리뷰).
 *
 * 차례는 **시험지에 실린 그대로**다(쪽 → 번호). 캔버스는 같은 지문의 문항이 붙어 있어야
 * 저장되므로(`isContiguous`) 받는 순서가 곧 담기는 순서다.
 * @param passageId - 지문 id
 * @returns 그 지문의 문항 (출처 포함)
 */
export async function fetchProblemsOfPassageForAdd(
  passageId: string,
): Promise<ProblemRow[]> {
  const { data, error } = await supabase
    .from('problems')
    .select(PROBLEM_LIST_SELECT)
    .eq('passage_id', passageId)
    .order('page_no')
    .order('number', { nullsFirst: false })
    .order('id');
  if (error) throw error;
  return (data ?? []) as unknown as ProblemRow[];
}

/**
 * 조건에 맞는 문항을 **문제지에 담으려고** 한꺼번에 가져온다.
 *
 * 목록 화면과 다른 점 둘:
 *  - 쪽을 나누지 않는다. 폴더를 통째로 담는 길이라 화면에 보이는 60개가 아니라
 *    **조건에 걸린 전부**를 받아야 한다.
 *  - 조건이 무엇이든 늘 **읽는 순서**다. 최근순으로 담으면 같은 지문의 문항이 흩어져
 *    저장할 때 '같은 지문의 문항이 떨어져 있다' 로 막힌다(RPC 의 연속성 검사).
 *
 * ⚠️ `limit` 은 문제지 상한(`PAPER_MAX_ITEMS`, 200)에서 온다 — PostgREST 기본 상한
 *    1,000 보다 한참 작아 한 번의 요청으로 끝난다. 상한을 넘겨 부르지 말 것.
 *    돌려주는 `total` 은 **조건에 걸린 전체 개수**라, 받아 온 행보다 클 수 있다
 *    (부르는 쪽이 그때 담기를 막는다 — 앞에서 잘라 담으면 지문 묶음이 끊긴다).
 * @param query - 필터
 * @param limit - 받아 올 최대 행 수
 * @returns 읽는 순서의 행과 조건에 걸린 전체 개수
 */
export async function fetchProblemsForBulkAdd(
  query: ProblemQuery, limit: number,
): Promise<ProblemPage> {
  if (limit < 1) return { rows: [], total: 0 };
  return runProblemQuery(query, 'reading', 0, limit - 1);
}
