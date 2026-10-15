import { SOURCE_EQ_AXES, sourceAxisArgs, type SourceAxisArgs } from './source-axes';
import type { ProblemQuery } from './queries';

/**
 * 아카이브 목록의 **작품·문법 축은 함수에서 출발한다**(sql/72 `exam.problems_for_archive`).
 *
 * 까닭: RLS 아래에서는 배열 `@>`·`&&`·`=` 가 leakproof 가 아니라 GIN 인덱스(`idx_problems_work_titles`·
 * `idx_problems_grammar_paths`)가 조건이 될 수 없다(sql/66 머리말). 그래서 작품·문법을 누를 때마다 문항 표
 * 전체(11,028쪽)를 훑었고, 메모리가 모자란 이 인스턴스에서는 그 한 번이 수 초였다(2026-10-15 실측 — 최대 4.9·5.8초).
 * SECURITY DEFINER 함수는 소유자로 돌아 GIN 을 탄다(인기 작품 582건 305쪽).
 *
 * ⚠️ 함수 결과에도 PostgREST 가 select·임베드·수평 필터·정렬·쪽·count 를 그대로 건다 — 그래서 나머지 조건은
 *    query-chain.ts 의 **같은 체인**이 건다. 다만 운영 PostgREST 14.5 는 함수 결과의 **임베드에 필터를 못 건다**
 *    (`source.grade=…` → `column pgrst_call.grade does not exist`). 출처 칸은 함수 인자 `p_source` 로 넘긴다.
 * ⚠️ 영역·단원 축은 함수로 보내지 않는다 — `area_path @> {'문학'}` 은 1만 5천 행이라 함수 결과를 구체화하는
 *    쪽이 순차 스캔보다 나쁘다. 그 축만 걸리면 예전처럼 표에서 출발한다.
 * ⚠️ postgrest-js `.rpc()` 기본값인 **POST** 로 부른다. GET 은 배열 인자를 따옴표 없이 `{a,b}` 로 실어
 *    쉼표 든 작품명이 두 원소로 갈린다(2026-09-27 의 그 버그) — JSON 본문이면 그대로 간다.
 */

/** 작품·문법 축 목록 함수 이름 (sql/72) */
export const ARCHIVE_LIST_RPC = 'problems_for_archive';

/** 함수 인자 — 이름은 sql/72 의 매개변수와 같아야 한다(PostgREST 가 이름으로 짝짓는다) */
export interface ArchiveRpcArgs {
  p_work_title: string | null;
  p_only_work: boolean;
  p_grammar_paths: string[] | null;
  /** 출처 칸 — 키가 있으면 건다(`''` 은 미지정인 것만). 함수가 모르는 키는 거절한다 */
  p_source: SourceAxisArgs;
}

/** 함수가 거르는 조회 칸 — 체인에는 이것을 뺀 나머지만 넘긴다 */
const RPC_COVERED_KEYS = [
  'work_title', 'only_work', 'grammar_paths', ...SOURCE_EQ_AXES, 'grades',
] as const satisfies readonly (keyof ProblemQuery)[];

/** 함수 인자와 체인에 넘길 나머지 조건 */
export interface ArchiveRpcSplit {
  args: ArchiveRpcArgs;
  rest: ProblemQuery;
}

/**
 * 작품·문법 축이 걸렸으면 함수 인자와 나머지 조건으로 가른다.
 *
 * 축이 걸렸는지는 지금 체인의 규칙 그대로다 — 작품명은 **비지 않은 글자**, 문법은 **비지 않은 배열**
 * (빈 작품명은 자유 텍스트 축이라 '미지정만' 이 없다, filters.ts).
 * @param query - 조회 조건
 * @returns 함수로 출발할 때의 인자와 나머지, 아니면 null(표에서 출발)
 */
export function splitArchiveRpc(query: ProblemQuery): ArchiveRpcSplit | null {
  const workTitle = query.work_title ? query.work_title : null;
  const grammarPaths = query.grammar_paths && query.grammar_paths.length > 0
    ? [...query.grammar_paths] : null;
  if (workTitle === null && grammarPaths === null) return null;

  const rest: ProblemQuery = { ...query };
  for (const key of RPC_COVERED_KEYS) delete rest[key];
  return {
    args: {
      p_work_title: workTitle,
      p_only_work: workTitle !== null && Boolean(query.only_work),
      p_grammar_paths: grammarPaths,
      p_source: sourceAxisArgs(query),
    },
    rest,
  };
}
