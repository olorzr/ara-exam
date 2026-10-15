import { pgArrayLiteral } from '@/lib/pg-array-literal';
import { applySourceAxes } from './source-axes';
import type { ProblemQuery } from './queries';

/**
 * 아카이브 목록의 **필터 체인 한 벌** — 정렬과 조건.
 *
 * `queries.ts` 의 `runProblemQuery` 가 출발점(문항 표 또는 작품·문법 함수, archive-rpc.ts)을 고른 뒤
 * 같은 체인을 건다. ⚠️ 조회 함수마다 베끼지 말 것 — 언젠가 한쪽만 고쳐져 "목록에는 보이는데 담기에는
 * 안 걸리는" 문항이 생긴다(목록·폴더 담기·유형 비율 담기가 모두 `runProblemQuery` 를 지난다).
 * (queries.ts 가 300줄을 넘어 2026-10-15 에 갈라 냈다 — 규칙은 그대로다.)
 */

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
export type ProblemOrder =
  /** 최근에 올린 것부터, 같은 때 올라온 것끼리는 시험지에 실린 차례 — 아카이브 기본 */
  | 'recent'
  /** 출처 > 지문 > 쪽 > 번호 — 시험지에 실린 차례 그대로 */
  | 'reading';

/** 정렬 칸 하나 */
interface OrderKey {
  column: string;
  ascending?: boolean;
  nullsFirst?: boolean;
}

/**
 * 순서마다 정렬 칸.
 *
 * reading — 지문 순서로 늘어놓는다. 화면이 지문별로 묶어 그리므로 같은 지문의 문항이 흩어지면
 *   같은 지문 머리가 여러 번 나온다. 문제지에 담을 때도 이 순서라야 지문 묶음이 붙는다.
 *   출처를 먼저 묶는 이유: 같은 작품이라도 학교마다 실린 대목이 다르다.
 *
 * recent — ⚠️ created_at 만으로 정렬하면 안 된다. 한 번에 저장한 행은 **같은 시각**을 받는다
 *   (`save.ts` 의 `savedAt` 이 굳혀 보낸다). 동률이 페이지 경계에 걸리면 쪽을 넘길 때마다 어떤 문항은
 *   두 번 나오고 어떤 문항은 영영 안 나온다(코덱스 리뷰 5R).
 *   ⚠️ 그 동률을 **읽는 순서로** 푸는 것이 중요하다. id 는 gen_random_uuid() 라 그것만으로 풀면 한 시험지
 *   안이 **무작위**로 나열돼 같은 지문의 문항이 흩어진다. 옆에 둔 묶음끼리의 차례(최근 업로드가 위)는
 *   created_at 이 그대로 정하고, **묶음 안**만 시험지에 실린 차례로 푼다.
 *   ⚠️ id 는 여전히 **마지막**이어야 한다 — 그것이 총순서를 만들어 쪽 넘김을 안정시킨다.
 *   ⚠️ 그래서 저장하는 쪽이 **한 번의 저장에 created_at 을 하나로 굳혀 보낸다**(`save.ts` 의 `savedAt`).
 *   안 그러면 50건 묶음마다 시각이 달라 100문항짜리 시험지가 **51~100번 다음에 1~50번**으로 뒤집힌다 —
 *   **두 파일은 한 쌍이다.** 칸·방향을 바꾸면 정렬 인덱스(sql/66 `idx_problems_recent`)도 함께.
 */
const PROBLEM_ORDERS: Record<ProblemOrder, readonly OrderKey[]> = {
  reading: [
    { column: 'source_id' },
    { column: 'passage_id', nullsFirst: false },
    { column: 'page_no' },
    { column: 'number', nullsFirst: false },
    { column: 'id' },
  ],
  recent: [
    { column: 'created_at', ascending: false },
    { column: 'page_no' },
    { column: 'number', nullsFirst: false },
    { column: 'id' },
  ],
};

/**
 * select 문자열에 정렬 칸이 없으면 덧붙인다.
 *
 * ⚠️ 작품·문법 함수(sql/72)의 결과는 **select 에 없는 칸으로 정렬하지 못한다** — 운영 PostgREST 14.5 가
 *    `column problems.passage_id does not exist` 로 거절한다(2026-10-15 실측). 목록 select 에는 정렬 칸이
 *    다 있지만 유형 비율 담기의 가벼운 select(`type-mix-queries.ts`)에는 없다. 덧붙인 칸은 행에 더 실릴 뿐이다.
 * @param select - PostgREST select 문자열
 * @param order - 늘어놓을 순서
 * @returns 정렬 칸이 모두 든 select 문자열
 */
export function withOrderColumns(select: string, order: ProblemOrder): string {
  const present = new Set(topLevelColumns(select));
  if (present.has('*')) return select;
  const missing = PROBLEM_ORDERS[order].map((k) => k.column).filter((c) => !present.has(c));
  return missing.length > 0 ? `${select}, ${missing.join(', ')}` : select;
}

/** select 의 최상위 칸 이름 — 임베드 괄호 안의 쉼표는 가르지 않는다 */
function topLevelColumns(select: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of select) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  parts.push(current.trim());
  return parts.filter((p) => p !== '' && !p.includes('('));
}

/** 조건과 정렬을 걸 수 있는 요청 — PostgREST 필터 빌더(표·함수 결과 둘 다)의 필요한 부분만 */
export interface ProblemChain<T> {
  eq(column: string, value: string): T;
  in(column: string, values: readonly string[]): T;
  contains(column: string, value: string): T;
  overlaps(column: string, value: string): T;
  like(column: string, pattern: string): T;
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): T;
  range(from: number, to: number): T;
}

/**
 * 순서대로 정렬을 건다.
 * @param request - 필터 빌더
 * @param order - 늘어놓을 순서
 * @returns 정렬을 건 빌더
 */
export function applyProblemOrder<T extends ProblemChain<T>>(request: T, order: ProblemOrder): T {
  let next = request;
  // 빠진 옵션은 postgrest-js 기본값(오름차순, nulls 위치 지정 없음)이라 `.order(칸)` 과 같은 URL 이 된다
  for (const key of PROBLEM_ORDERS[order]) {
    next = next.order(key.column, { ascending: key.ascending, nullsFirst: key.nullsFirst });
  }
  return next;
}

/**
 * 조회 조건을 건다.
 *
 * ⚠️ 작품·문법 함수 경로에서는 그 함수가 이미 거른 칸(작품·문법·출처)을 **뺀 조건**이 넘어온다
 *    (archive-rpc.ts 의 `splitArchiveRpc`) — 함수 결과의 임베드(`source.`)에는 필터를 걸 수 없어서다.
 * @param request - 필터 빌더
 * @param query - 조회 조건
 * @returns 조건을 건 빌더
 */
export function applyProblemFilters<T extends ProblemChain<T>>(request: T, query: ProblemQuery): T {
  // ⚠️ 임베드에 별칭(`source:`)을 주면 필터 경로도 **별칭**을 써야 한다.
  //    `problem_sources.year` 로 쓰면 PostgREST 가 "그런 임베드 없음" 으로 요청을 거부한다.
  // ⚠️ 있고 없음은 `undefined` 로 가른다. `''` 은 **'미지정인 행만'** 이라는 뜻이라
  //    참거짓으로 거르면 그 조건이 통째로 사라진다(filters.ts 의 UNSPECIFIED_AXIS).
  let next = applySourceAxes(request, query, 'source.');
  // ⚠️ `.eq('work_title', …)` 이 아니다(sql/33). 파생 문자열로 걸면 `(가)(나)` 지문의 문항이
  //    `'먼 후일 · 독은 아름답다'` 로만 걸려 '먼 후일' 을 골랐을 때 하나도 안 나온다.
  // ⚠️ 배열 컬럼 조건은 전부 `pgArrayLiteral` 문자열로 넘긴다 — postgrest-js 는 배열을 따옴표
  //    없이 join 해서 쉼표 든 제목(「소녀, 두드리다」)이 두 원소로 갈려 **0건**이 됐다(2026-09-27)
  // '그 작품만' 이면 **같음**(eq)이다 — 포함(cs)으로는 (가)(나) 를 함께 묻는 문항이 걸린다.
  if (query.work_title) {
    const titles = pgArrayLiteral([query.work_title]);
    next = query.only_work
      ? next.eq('work_titles', titles) : next.contains('work_titles', titles);
  }
  // 갈래 필터 — 넘어온 유형 가운데 하나면 통과. 빈 배열은 '조건 없음' 이라 걸지 않는다
  if (query.question_types && query.question_types.length > 0) {
    next = next.in('question_type', query.question_types);
  }
  if (query.area_path && query.area_path.length > 0) {
    // 배열 포함 — '문학' 으로 찾으면 '문학 > 현대시' 문항도 걸린다
    next = next.contains('area_path', pgArrayLiteral(query.area_path));
  }
  if (query.unit_path && query.unit_path.length > 0) {
    // 같은 이유로 대단원만 골라도 그 아래 소단원 문항이 함께 걸린다
    next = next.contains('unit_path', pgArrayLiteral(query.unit_path));
  }
  if (query.grammar_paths && query.grammar_paths.length > 0) {
    // ⚠️ 여기만 `contains` 가 아니라 **`overlaps`** 다. 이 컬럼은 원소 하나가 경로 하나라
    //    (`'단어 > 품사 > 명사'`) 문항에 여러 개가 붙는다 — `@>` 는 "준 것을 **전부** 가진 행"
    //    이라 두 태그를 넘기면 둘 다 붙은 문항만 나온다(grammar-tree.ts 의 grammarPathsUnder).
    next = next.overlaps('grammar_paths', pgArrayLiteral(query.grammar_paths));
  }
  if (query.passage_areas && query.passage_areas.length > 0) {
    // ⚠️ `pgArrayLiteral` 이 아니다 — `passage_area` 는 배열이 아니라 글자 칸이다. postgrest-js 의
    //    `in()` 은 쉼표·괄호가 든 값만 따옴표로 감싸므로 `''` 은 `in.(화법과 언어,)` 로 실린다
    //    (그 꼴이 운영 PostgREST 에서 '빈 값' 으로 읽히는 것을 확인했다 — quiz-references/candidates.ts)
    next = next.in('passage_area', query.passage_areas);
  }
  if (query.search?.trim()) {
    // .or() 를 쓰지 않는다 — 백슬래시·괄호 이스케이프가 인용을 통과하며 풀린다.
    // ⚠️ ilike 가 아니라 **like** 다(sql/66). search_text 는 트리거가 이미 lower() 로 저장하고
    //    검색어도 여기서 소문자로 바꾸므로 결과가 같은데, 대소문자 접기가 빠져 한글에서 4배 빠르다.
    //    인덱스는 못 쓴다 — RLS 아래에서 LIKE 는 leakproof 가 아니라 인덱스 조건이 될 수 없다(sql/66 머리말).
    //    트리거의 lower() 를 걷으면 이것도 ilike 로 되돌릴 것
    next = next.like('search_text', `%${escapeIlike(query.search.trim().toLowerCase())}%`);
  }
  return next;
}
