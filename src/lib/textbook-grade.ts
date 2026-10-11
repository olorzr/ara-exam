import { HIGH_SCHOOL_GRADES, MIDDLE_SCHOOL_GRADES } from './constants';

/**
 * 교과서 학년 선택지 (카테고리 관리·단어 등록) — `semester.ts` 의 거울.
 *
 * ⚠️ 여기 '학년' 은 **교과서의 학년**이다(`major_chapters`·`categories`·`concept_sheets`·작품 전문 단원).
 *    기출 출처의 학년(`problem_sources.grade` — 시험을 본 학년)과는 다른 값이다.
 *
 * 고등 선택과목(문학·화법과 언어·독서와 작문 등)은 고2 에서도 고3 에서도 배운다(원장님, 2026-10-11).
 * 그런 교과서는 학년을 **빈 문자열**로 저장하고 화면에서는 '선택과목' 이라 부른다. 저장할 때만 `''` 로 바꾼다.
 * 관리자시스템(curriculum_textbooks)도 같은 글자('선택과목')를 교과서 이름으로 쓴다.
 */

/** 학년 구분 없는 교과서의 선택 표시값 — 저장값은 `''` */
export const NO_GRADE_OPTION = '선택과목';

/**
 * 중등·고등 교과서 학년 선택지. 중등 국어는 늘 학년별 권이라 '선택과목' 을 내주지 않는다.
 * (외부지문 학년 선택지는 `external-category.ts` 의 `EXTERNAL_GRADE_OPTIONS` 다 — 다른 뜻이다)
 * @param level - 구분('중등' | '고등')
 * @returns 선택지 목록
 */
export function gradeOptionsFor(level: string): readonly string[] {
  return level === '고등' ? [...HIGH_SCHOOL_GRADES, NO_GRADE_OPTION] : MIDDLE_SCHOOL_GRADES;
}

/**
 * 선택 표시값 → 저장값('선택과목' → '').
 * @param option - Select 에서 고른 값
 * @returns DB 에 저장할 학년
 */
export function toStoredGrade(option: string): string {
  return option === NO_GRADE_OPTION ? '' : option;
}

/**
 * 트리 폴더·요약 줄에 쓰는 학년 이름. 학년이 빈 **고등** 교과서는 '선택과목',
 * 그 밖의 빈 학년(중등에 남은 옛 행 등)은 '미지정' — 중등에는 선택과목이 없다.
 * @param stored - DB 의 학년
 * @param level - 구분. 모르면 생략(고등으로 보지 않는다)
 * @returns 표시할 학년
 */
export function textbookGradeLabel(stored: string, level?: string): string {
  if (stored) return stored;
  return level === '고등' ? NO_GRADE_OPTION : '미지정';
}
