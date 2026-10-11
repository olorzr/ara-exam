/**
 * 출처 칸(유형·학교·학년도·학년·학기·시험·교과서·학교급) 조건 — 아카이브와 올라간 기출 목록이
 * **한 벌**을 쓴다.
 *
 * 아카이브는 문항에 붙인 출처 임베드(`source.`)에, 올라간 기출 목록은 출처 표 자체(`''`)에
 * 건다. 둘이 따로 적으면 한쪽만 '미지정' 을 다르게 다뤄 같은 조건이 두 화면에서 다른 개수를 낸다.
 * (queries.ts 가 300줄을 넘어 2026-10-11 에 갈라 냈다 — 규칙은 그대로다.)
 */

/** 출처 칸 가운데 **값 하나로 같음(eq)** 을 거는 것들 */
export const SOURCE_EQ_AXES = [
  'source_type', 'school_name', 'year', 'grade', 'semester', 'exam_type', 'textbook',
] as const;

/** 출처 칸 조건만 모은 모양 */
export interface SourceAxisQuery {
  source_type?: string;
  school_name?: string;
  year?: string;
  grade?: string;
  /** 학년 **여럿** — 하나라도 맞으면 걸린다(`in`). 학교급 필터가 편 값이다 */
  grades?: string[];
  /** 학기 ('1학기'·'2학기') */
  semester?: string;
  exam_type?: string;
  /** 교과서 (출처의 textbook) */
  textbook?: string;
}

/** 조건을 걸 수 있는 요청 — PostgREST 필터 빌더의 필요한 부분만 */
interface SourceAxisFilterable<T> {
  eq(column: string, value: string): T;
  in(column: string, values: readonly string[]): T;
}

/**
 * 출처 칸 조건을 건다.
 *
 * ⚠️ 있고 없음은 `undefined` 로 가른다. `''` 은 **'미지정인 행만'** 이라는 뜻이라
 *    참거짓으로 거르면 그 조건이 통째로 사라진다(filters.ts 의 UNSPECIFIED_AXIS).
 * @param request - 필터 빌더
 * @param query - 조건 (`toProblemQuery` 가 만든 값)
 * @param prefix - 컬럼 앞머리 (임베드 별칭 `'source.'` 또는 `''`)
 * @returns 조건을 건 빌더
 */
export function applySourceAxes<T extends SourceAxisFilterable<T>>(
  request: T, query: SourceAxisQuery, prefix: '' | 'source.',
): T {
  let next = request;
  for (const key of SOURCE_EQ_AXES) {
    const value = query[key];
    if (value !== undefined) next = next.eq(`${prefix}${key}`, value);
  }
  // 학교급을 편 학년들 — 학년 칸(eq)과 **따로** 건다(둘 다 걸리면 교집합)
  if (query.grades && query.grades.length > 0) next = next.in(`${prefix}grade`, query.grades);
  return next;
}
