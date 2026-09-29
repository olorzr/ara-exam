import type { ProblemSource } from '@/types/problem-bank';

/**
 * 출처를 한 줄로 보여 준다 (순수 함수).
 *
 * 이 함수는 **화면과 인쇄물의 문항 위 출처 줄**을 만든다(2026-09-20 부터 인쇄도 여기를 쓴다).
 *
 * ⚠️ `problem_papers.source_labels`(문제지 **목록 화면**이 쓰는 값)는 DB(RPC)가 따로 만들고
 *    **규칙이 한 군데 다르다**: 그쪽에는 **출판사 자리가 아예 없다.** 그래서 학교가 없는
 *    출처(문제집)는 `2026 중2 1학기` 처럼 출판사만 빠진 줄이 되고, **년도·학년·학교·학기·시험이
 *    모두** 비어 있을 때에만 출처 **제목**으로 떨어진다. 여기(문항 위·카드)는 그 자리에 출판사를
 *    넣어 `2026 중2 천재 1학기` 가 된다.
 *    ⚠️ 순서나 자리를 바꿀 일이 생기면 **sql 의 가장 큰 번호 정의도 함께** 고칠 것
 *    (지금은 [sql/35](../../../sql/35_problem_paper_source_semester.sql)).
 * ⚠️ **모의고사는 제목을 쓴다**(2026-09-29). 문제지 목록 쪽(sql/35)은 그대로 칸을 이어
 *    `2026 고3 수능` 이 된다 — 목록 요약으로는 그걸로 충분해서 SQL 은 고치지 않았다.
 */

/** 라벨을 만들 수 있는 최소한의 필드 */
export type SourceLabelInput = Pick<
  ProblemSource,
  'source_type' | 'title' | 'school_name' | 'year' | 'grade' | 'exam_type' | 'publisher'
> & {
  /**
   * 학기.
   *
   * ⚠️ **옵셔널이다** — 문제지 스냅샷(`PaperSourceSnapshot`)은 sql/35 전에 만든 것에
   *    이 키가 없다. 출처 행(`ProblemSource`)에는 늘 있다.
   */
  semester?: string;
};

/**
 * 목록·카드에 쓰는 한 줄 라벨.
 * @param source - 출처 (일부 필드만 있어도 된다)
 * @returns '2026 중2 상현중 1학기 중간' 같은 문자열. 만들 수 없으면 제목
 */
export function sourceLabel(source: SourceLabelInput): string {
  // 모의고사는 **제목**을 쓴다 — 칸을 이으면 '2026 고3 평가원 수능' 이 되어 한 시험의
  // 공통·화법과 작문·언어와 매체(또는 A형·B형)가 같은 줄이 되고, 35번이 둘이 된다.
  // 제목은 '2026학년도 수능 (언어와 매체)' 처럼 그 차이를 담아 적는다(적재 규약)
  if (source.source_type === '모의고사' && source.title.trim()) return source.title;
  return sourceMetaLabel(source);
}

/**
 * 칸만 이은 라벨 — **제목을 따로 보여 주는 화면**(문항 편집·검수 머리)용.
 *
 * `sourceLabel` 은 모의고사면 제목을 돌려주므로 그 화면에서 쓰면 제목이 두 번 찍힌다
 * (`2026학년도 수능 … · 2026학년도 수능 …`, 코덱스 리뷰 4R). 여기는 유형과 상관없이 칸을 잇는다.
 * @param source - 출처 (일부 필드만 있어도 된다)
 * @returns '2026 고3 평가원 수능' 같은 문자열. 만들 수 없으면 제목
 */
export function sourceMetaLabel(source: SourceLabelInput): string {
  const parts = [
    source.year,
    source.grade,
    source.school_name || source.publisher,
    // 학기가 없으면 '중간' 이 1학기인지 2학기인지 알 수 없다 — 아카이브에 학기 축이
    // 따로 있는 것도 그래서다. 옛 문제지 스냅샷에는 이 값이 없어 조용히 빠진다
    source.semester,
    source.exam_type,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : source.title;
}

/**
 * 유형까지 붙인 긴 라벨 (필터 결과 요약 등).
 * @param source - 출처
 * @returns '내신기출 · 2026 중2 상현중 1학기 중간'
 */
export function sourceLabelWithType(source: SourceLabelInput): string {
  return `${source.source_type} · ${sourceLabel(source)}`;
}
