import { supabase } from '@/lib/supabase';
import type { Passage, Problem, ProblemSource } from '@/types/problem-bank';

/**
 * 기출 아카이브 조회.
 *
 * ⚠️ PostgREST 는 기본 1,000행에서 잘린다. 목록은 **반드시 `.range()` 로 페이지**를 나누고
 *    총 개수는 `count: 'exact'` 로 따로 받는다(조용히 잘린 목록이 '전부'로 보이면 안 된다).
 */

/** 목록에 필요한 컬럼만 — 본문 HTML 은 무겁다 */
const PROBLEM_LIST_COLUMNS =
  'id, source_id, passage_id, number, question_type, stem_html, choices, answer, '
  + 'area_path, unit_path, grammar_paths, work_title, page_no, image_path, render_mode, '
  + 'status, created_at';

/** 한 화면에 보여 줄 문항 수 */
export const PROBLEM_PAGE_SIZE = 60;

// 출처 **목록** 조회는 `source-list.ts` 로 옮겼다(`SOURCE_PAGE_SIZE`·`fetchSources`·
// `refetchSources`). 출처를 지울 수 있게 되면서 offset 이 움직이는 목록이 되어 규약이
// 달라졌다 — 여기 남은 `fetchSource` 는 **한 건** 조회라 그 영향을 받지 않는다.

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
   * 상위를 골랐을 때 그 아래 잎으로 펴는 일은 `filters.ts` 가 이미 끝내고 넘긴다.
   */
  grammar_paths?: string[];
  /** 작품명. 이 조건이 걸리면 목록이 **지문 순서**로 정렬된다 */
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

/**
 * 아카이브 목록을 한 페이지 가져온다.
 * @param query - 필터
 * @returns 행과 전체 개수
 */
export async function fetchProblemPage(query: ProblemQuery): Promise<ProblemPage> {
  const page = Math.max(0, query.page ?? 0);
  const from = page * PROBLEM_PAGE_SIZE;

  let request = supabase
    .from('problems')
    .select(`${PROBLEM_LIST_COLUMNS}, source:problem_sources!inner(*)`, { count: 'exact' });

  if (query.work_title !== undefined) {
    // 작품으로 볼 때는 **지문 순서**로 늘어놓는다 — 화면이 지문별로 묶어 그리므로
    // 같은 지문의 문항이 흩어지면 같은 지문 머리가 여러 번 나온다.
    // 출처를 먼저 묶는 이유: 같은 작품이라도 학교마다 실린 대목이 다르다
    request = request
      .order('source_id')
      .order('passage_id', { nullsFirst: false })
      .order('page_no')
      .order('number', { nullsFirst: false })
      .order('id');
  } else {
    request = request
      .order('created_at', { ascending: false })
      // ⚠️ created_at 만으로 정렬하면 안 된다 — OCR 은 50건씩 한 트랜잭션으로 넣어서
      //    한 묶음의 모든 행이 **같은 now()** 를 받는다. 동률이 페이지 경계에 걸리면
      //    쪽을 넘길 때마다 어떤 문항은 두 번 나오고 어떤 문항은 영영 안 나온다(코덱스 리뷰 5R)
      .order('id', { ascending: false });
  }

  request = request.range(from, from + PROBLEM_PAGE_SIZE - 1);

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
  // ⚠️ 참거짓이 아니라 undefined 로 가른다 — filters.ts 의 규약(빈 문자열은 '미지정만')
  if (query.work_title !== undefined) request = request.eq('work_title', query.work_title);
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
    //    이라 두 태그를 넘기면 둘 다 붙은 문항만 나온다. 상위 검색은 잎을 나열해 찾는 것이라
    //    "하나라도 걸리면" 이 맞다(grammar-tree.ts 의 grammarPathsUnder).
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
