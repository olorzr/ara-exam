import { supabase } from '@/lib/supabase';
import type { Problem, ProblemSource } from '@/types/problem-bank';

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

/** 한 화면에 보여 줄 문항 수 */
export const PROBLEM_PAGE_SIZE = 60;

// 출처를 다루는 조회는 이 파일에 없다 — 셋으로 갈려 있다:
//  · `source-list.ts` — 출처 **목록**(`SOURCE_PAGE_SIZE`·`fetchSources`·`refetchSources`).
//    출처를 지울 수 있게 되면서 offset 이 움직이는 목록이 되어 규약이 달라졌다.
//  · `source-queries.ts` — 출처 **한 건**과 그 지문·문항 전부(`fetchSource`·`fetchPassages`·
//    `fetchProblemsOfSource`·`fetchProblem`). 검수 화면이 쓰고, 빠짐없이 읽는 것이 계약이다.
//  · 여기는 **아카이브 목록**뿐이다 — 조건으로 걸러 한 쪽씩, 컬럼을 좁혀 읽는다.

export interface ProblemPage {
  rows: (Problem & { source: ProblemSource })[];
  /** 필터에 걸린 전체 개수 (페이지 수 계산용) */
  total: number;
}

/** 목록 조회 조건 */
export interface ProblemQuery {
  source_type?: string;
  school_name?: string;
  year?: string;
  grade?: string;
  /** 학기 ('1학기'·'2학기') */
  semester?: string;
  exam_type?: string;
  /** 교과서 (출처의 textbook) */
  textbook?: string;
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
  /** 발문·선지·작품명 평문 검색 */
  search?: string;
  /** '검수완료' 만 보기 */
  verifiedOnly?: boolean;
  page?: number;
}

/**
 * ilike 패턴에서 와일드카드를 막는다.
 *
 * `%`·`_` 를 그대로 넘기면 사용자가 친 글자가 패턴이 되어 엉뚱한 결과가 나온다.
 * @param value - 사용자가 친 검색어
 * @returns 이스케이프된 문자열
 */
export function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/** 목록을 늘어놓는 순서 */
type ProblemOrder =
  /** 최근에 올린 것부터, 같은 때 올라온 것끼리는 시험지에 실린 차례 — 아카이브 기본 */
  | 'recent'
  /** 출처 > 지문 > 쪽 > 번호 — 시험지에 실린 차례 그대로 */
  | 'reading';

/**
 * 조건에 맞는 문항을 한 구간 읽는다.
 *
 * ⚠️ 필터 체인·컬럼 목록·임베드 별칭이 **여기 한 벌**뿐이어야 한다. 조회 함수마다 베끼면
 *    언젠가 한쪽만 고쳐져 "목록에는 보이는데 담기에는 안 걸리는" 문항이 생긴다.
 * @param query - 필터
 * @param order - 늘어놓을 순서
 * @param from - 첫 행 (0부터)
 * @param to - 마지막 행 (포함)
 * @returns 행과 조건에 걸린 전체 개수
 */
async function runProblemQuery(
  query: ProblemQuery, order: ProblemOrder, from: number, to: number,
): Promise<ProblemPage> {
  let request = supabase
    .from('problems')
    .select(`${PROBLEM_LIST_COLUMNS}, source:problem_sources!inner(*)`, { count: 'exact' });

  if (order === 'reading') {
    // 지문 순서로 늘어놓는다 — 화면이 지문별로 묶어 그리므로 같은 지문의 문항이 흩어지면
    // 같은 지문 머리가 여러 번 나온다. 문제지에 담을 때도 이 순서라야 지문 묶음이 붙는다.
    // 출처를 먼저 묶는 이유: 같은 작품이라도 학교마다 실린 대목이 다르다
    request = request
      .order('source_id')
      .order('passage_id', { nullsFirst: false })
      .order('page_no')
      .order('number', { nullsFirst: false })
      .order('id');
  } else {
    // ⚠️ created_at 만으로 정렬하면 안 된다 — 한 번에 저장한 행은 **같은 시각**을 받는다
    //    (`save.ts` 의 `savedAt` 이 굳혀 보낸다). 동률이 페이지 경계에 걸리면
    //    쪽을 넘길 때마다 어떤 문항은 두 번 나오고 어떤 문항은 영영 안 나온다(코덱스 리뷰 5R).
    //    ⚠️ 그 동률을 **읽는 순서로** 푸는 것이 중요하다. id 는 gen_random_uuid() 라
    //    그것만으로 풀면 한 시험지 안이 **무작위**로 나열돼 같은 지문의 문항이 흩어진다 —
    //    화면이 지문별로 묶어 그리므로 같은 지문 머리가 여러 번 나온다.
    //    옆에 둔 묶음끼리의 차례(최근 업로드가 위)는 created_at 이 그대로 정하고,
    //    **묶음 안**만 시험지에 실린 차례로 풀어 같은 지문의 문항이 이웃하게 한다.
    //    ⚠️ id 는 여전히 **마지막**이어야 한다 — 그것이 총순서를 만들어 쪽 넘김을 안정시킨다
    //    (쪽 순서는 오름차순이다: 한 출처 안에서는 1쪽이 앞이 맞고, 출처끼리의 새것이 위라는 규약은 created_at 이 지킨다).
    //    ⚠️ 그래서 저장하는 쪽이 **한 번의 저장에 created_at 을 하나로 굳혀 보낸다**
    //    (`save.ts` 의 `savedAt`). 안 그러면 50건 묶음마다 시각이 달라 100문항짜리 시험지가
    //    **51~100번 다음에 1~50번**으로 뒤집히고 그 경계의 지문이 두 묶음으로 갈린다 —
    //    **두 파일은 한 쌍이다.** 그것이 붙기 전에 올린 옛 출처는 여전히 묶음 단위로 갈려 보인다
    request = request
      .order('created_at', { ascending: false })
      .order('page_no')
      .order('number', { nullsFirst: false })
      .order('id');
  }

  request = request.range(from, to);

  // ⚠️ 임베드에 별칭(`source:`)을 주면 필터 경로도 **별칭**을 써야 한다.
  //    `problem_sources.year` 로 쓰면 PostgREST 가 "그런 임베드 없음" 으로 요청을 거부한다.
  // ⚠️ 있고 없음은 `undefined` 로 가른다. `''` 은 **'미지정인 행만'** 이라는 뜻이라
  //    참거짓으로 거르면 그 조건이 통째로 사라진다(filters.ts 의 UNSPECIFIED_AXIS).
  if (query.source_type !== undefined) request = request.eq('source.source_type', query.source_type);
  if (query.school_name !== undefined) request = request.eq('source.school_name', query.school_name);
  if (query.year !== undefined) request = request.eq('source.year', query.year);
  if (query.grade !== undefined) request = request.eq('source.grade', query.grade);
  if (query.semester !== undefined) request = request.eq('source.semester', query.semester);
  if (query.exam_type !== undefined) request = request.eq('source.exam_type', query.exam_type);
  if (query.textbook !== undefined) request = request.eq('source.textbook', query.textbook);
  // ⚠️ `.eq('work_title', …)` 이 아니다(sql/33). 파생 문자열로 걸면 `(가)(나)` 지문의 문항이
  //    `'먼 후일 · 독은 아름답다'` 로만 걸려 '먼 후일' 을 골랐을 때 하나도 안 나온다.
  //    빈 문자열('미지정만')은 이 축에 없다 — filters.ts 가 자유 텍스트라 막아 둔다
  if (query.work_title) request = request.contains('work_titles', [query.work_title]);
  if (query.verifiedOnly) request = request.eq('status', '검수완료');
  if (query.area_path && query.area_path.length > 0) {
    // 배열 포함 — '문학' 으로 찾으면 '문학 > 현대시' 문항도 걸린다
    request = request.contains('area_path', query.area_path);
  }
  if (query.unit_path && query.unit_path.length > 0) {
    // 같은 이유로 대단원만 골라도 그 아래 소단원 문항이 함께 걸린다
    request = request.contains('unit_path', query.unit_path);
  }
  if (query.grammar_paths && query.grammar_paths.length > 0) {
    // ⚠️ 여기만 `contains` 가 아니라 **`overlaps`** 다. 이 컬럼은 원소 하나가 경로 하나라
    //    (`'단어 > 품사 > 명사'`) 문항에 여러 개가 붙는다 — `@>` 는 "준 것을 **전부** 가진 행"
    //    이라 두 태그를 넘기면 둘 다 붙은 문항만 나온다. 상위 검색은 고른 마디와 그 아래
    //    경로를 나열해 찾는 것이라 "하나라도 걸리면" 이 맞다(grammar-tree.ts 의 grammarPathsUnder).
    request = request.overlaps('grammar_paths', query.grammar_paths);
  }
  if (query.search?.trim()) {
    // .or() 를 쓰지 않는다 — 백슬래시·괄호 이스케이프가 인용을 통과하며 풀린다.
    // 검색용 평문 컬럼 하나로 단순 ilike 를 건다(DB 트리거가 채운다).
    request = request.ilike('search_text', `%${escapeIlike(query.search.trim().toLowerCase())}%`);
  }

  const { data, error, count } = await request;
  if (error) throw error;
  return {
    rows: (data ?? []) as unknown as (Problem & { source: ProblemSource })[],
    total: count ?? 0,
  };
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
): Promise<(Problem & { source: ProblemSource })[]> {
  const { data, error } = await supabase
    .from('problems')
    .select(`${PROBLEM_LIST_COLUMNS}, source:problem_sources!inner(*)`)
    .eq('passage_id', passageId)
    .order('page_no')
    .order('number', { nullsFirst: false })
    .order('id');
  if (error) throw error;
  return (data ?? []) as unknown as (Problem & { source: ProblemSource })[];
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
