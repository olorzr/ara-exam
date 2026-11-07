import type { ProblemQuery } from './queries';

/**
 * 문제지 만들기의 **빼기 조건** — '이 문제지들에 담긴 문항 빼기' 와 '정답 없는 문항 빼기' (2026-11-07 원장 요청).
 *
 * 폴더 조건과 달리 '이 지문 전체 담기' 와 상세 창의 형제 문항까지 따라간다 — 1주차에 낸 문항을 빼고 2주차를 만드는데
 * 지문 담기 한 번으로 도로 들어오면 빼기가 거짓이 된다. 그래서 이 조건을 거는 곳은 아래 두 함수 한 벌이다.
 *
 * ⚠️ 표에서 출발할 때만 임베드 반조인을 쓴다(`problem_paper_items!left` + 임베드 `is.null`, 운영 PostgREST 14.5 에서 실측).
 *    작품·문법 함수의 결과에는 임베드 필터를 못 건다 — 그 경로에서는 `splitArchiveRpc` 가 `exclude_paper_ids` 를
 *    인자(`p_exclude_papers`, sql/97)로 옮기고 여기까지 넘기지 않는다. `answer` 는 제 칸이라 두 경로 모두 체인이 건다.
 */

/** 빼기 조건만 뗀 모양 — 지문 담기·상세 창처럼 폴더 조건을 보지 않는 조회가 받는다 */
export type PaperExclusionQuery = Pick<ProblemQuery, 'exclude_paper_ids' | 'answered_only'>;

/**
 * 한 번에 뺄 수 있는 문제지 수.
 *
 * ⚠️ 표 경로는 문제지 id 를 **GET 주소**에 싣는다 — 하나가 37자라 고르기 창이 내주는 200개를 다 고르면 8KB 를 넘어
 *    프록시 주소 상한에 걸리고 목록이 통째로 실패한다(코덱스 2R). 상한을 올릴 때는 다른 조건까지 실린 주소 길이를 볼 것
 *    (queries.test.ts 가 이 수로 재서 고정한다). 주마다 쌓는 쓰임이라 30개면 반년 치가 넘는다.
 */
export const PAPER_EXCLUDE_MAX = 30;

/** 임베드할 표 — 필터 경로도 같은 이름을 쓴다(별칭을 주면 필터도 별칭을 써야 한다, query-chain.ts) */
const PAPER_ITEMS_EMBED = 'problem_paper_items';

/** 조건을 걸 수 있는 요청 — PostgREST 필터 빌더의 필요한 부분만 */
interface ExclusionFilterable<T> {
  in(column: string, values: readonly string[]): T;
  is(column: string, value: null): T;
  neq(column: string, value: string): T;
}

/**
 * 뺄 문제지가 있으면 select 에 반조인 임베드를 덧붙인다.
 *
 * 없으면 글자 그대로 돌려준다 — 빼기 조건이 없는 화면의 요청 주소가 달라지지 않게 한다.
 * @param select - PostgREST select 문자열
 * @param query - 빼기 조건
 * @returns 임베드를 덧붙인 select 문자열
 */
export function withExclusionEmbed(select: string, query: PaperExclusionQuery): string {
  return query.exclude_paper_ids && query.exclude_paper_ids.length > 0
    ? `${select}, ${PAPER_ITEMS_EMBED}!left(paper_id)` : select;
}

/**
 * 빼기 조건을 건다.
 *
 * ⚠️ `in` 만 걸면 임베드 행이 비기만 하고 문항은 그대로다 — 문항을 떨어뜨리는 것은 뒤의 `is.null` 이다.
 * @param request - 필터 빌더 (`withExclusionEmbed` 를 거친 select 에서 출발해야 한다)
 * @param query - 빼기 조건
 * @returns 조건을 건 빌더
 */
export function applyPaperExclusions<T extends ExclusionFilterable<T>>(request: T, query: PaperExclusionQuery): T {
  let next = request;
  if (query.exclude_paper_ids && query.exclude_paper_ids.length > 0) {
    next = next.in(`${PAPER_ITEMS_EMBED}.paper_id`, query.exclude_paper_ids).is(PAPER_ITEMS_EMBED, null);
  }
  // 저장값은 `''` 뿐이다(NOT NULL DEFAULT '', 공백만인 값은 운영 0건) — 답을 안 적은 문항이 그 값이다
  if (query.answered_only) next = next.neq('answer', '');
  return next;
}

/**
 * 걸린 빼기 조건이 있는가.
 * @param query - 빼기 조건
 * @returns 하나라도 걸렸으면 true
 */
export function hasPaperExclusions(query: PaperExclusionQuery): boolean {
  return Boolean(query.answered_only) || (query.exclude_paper_ids?.length ?? 0) > 0;
}
