import { SEMESTER_OPTIONS } from './constants';

/**
 * 교과서 학기 선택지 (카테고리 관리·단어 등록).
 *
 * ⚠️ 여기 '학기' 는 **교과서 권의 학기**다(`major_chapters`·`categories`·`concept_sheets`).
 *    기출 출처·프린트의 학기(`problem_sources.semester` — 시험을 본 학기)와는 다른 값이다.
 *
 * 고등 선택과목(문학·화법과 언어·독서와 작문 등)은 1·2학기 구분 없이 한 권이고 학교마다
 * 1학기에도 2학기에도 쓴다(원장님, 2026-10-10). 그런 교과서는 학기를 **빈 문자열**로 저장한다 —
 * 이 저장소에서 `''` 는 이미 '없음' 규약이라(년도·학년·학교명) 새 표시값을 만들지 않았다.
 * 화면에서는 '학기 구분 없음' 으로 보이고 저장할 때만 `''` 로 바뀐다(base-ui Select 가 빈 값을
 * 다루기 까다로워 `external-category.ts` 의 '미지정' 과 같은 수를 쓴다).
 */

/** 학기 구분 없는 교과서의 선택 표시값 — 저장값은 `''` */
export const NO_SEMESTER_OPTION = '학기 구분 없음';

/**
 * 학교급별 학기 선택지. 중등 국어는 늘 학기별 권이라 '학기 구분 없음' 을 내주지 않는다.
 * @param level - 구분
 * @returns 선택지 목록
 */
export function semesterOptionsFor(level: string): readonly string[] {
  return level === '고등' ? [...SEMESTER_OPTIONS, NO_SEMESTER_OPTION] : SEMESTER_OPTIONS;
}

/**
 * 선택 표시값 → 저장값('학기 구분 없음' → '').
 * @param option - Select 에서 고른 값
 * @returns DB 에 저장할 학기
 */
export function toStoredSemester(option: string): string {
  return option === NO_SEMESTER_OPTION ? '' : option;
}

/**
 * 저장값 → 선택 표시값('' → '학기 구분 없음').
 * @param stored - DB 의 학기
 * @returns Select 에 넘길 값
 */
export function toSemesterOption(stored: string): string {
  return stored === '' ? NO_SEMESTER_OPTION : stored;
}

