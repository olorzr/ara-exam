import { HIGH_SCHOOL_GRADES, MIDDLE_SCHOOL_GRADES } from '@/lib/constants';
import { levelFromGrade, SCHOOL_LEVEL_OPTIONS, type SchoolLevel } from './source-form';

/**
 * 아카이브의 **학교급 필터** — 중등·고등 (순수 모듈).
 *
 * ⚠️ 학교급은 저장하지 않는다(source-form.ts 의 `SchoolLevel`). 필터도 출처의 `grade`
 *    ('중2') 를 그 학교급 학년 전부로 펴서 찾는다 — 학년이 빈 출처는 어느 쪽에도 안 걸린다.
 */

/** 학교급 필터 값. `''` 는 **전체**(조건을 만들지 않는다) */
export type SchoolLevelFilter = '' | SchoolLevel;

/**
 * 그 학교급의 학년들 — 조회 조건으로 펼 때 쓴다.
 * @param level - 학교급
 * @returns 학년 목록 ('미지정' 은 넣지 않는다)
 */
export function gradesForSchoolLevel(level: SchoolLevel): string[] {
  return [...(level === '고등' ? HIGH_SCHOOL_GRADES : MIDDLE_SCHOOL_GRADES)];
}

/**
 * 주소 값에서 학교급 필터를 복원한다.
 *
 * 모르는 값은 **전체**로 본다 — 오타 하나로 목록이 0건이 되면 왜 비었는지 알 수 없다.
 * @param raw - 주소 파라미터 값
 * @returns 학교급 필터
 */
export function parseSchoolLevel(raw: string | null | undefined): SchoolLevelFilter {
  return SCHOOL_LEVEL_OPTIONS.find((level) => level === raw) ?? '';
}

/**
 * 이 학년 필터 값이 학교급 필터와 함께 걸릴 수 있는가.
 *
 * ⚠️ '미지정만'(`__none__`)은 **어긋난 것**으로 본다 — 학년이 빈 출처는 어느 학교급에도
 *    안 걸리므로 둘을 같이 걸면 늘 0건이다.
 * @param grade - 학년 필터 값 ('중2' · '' · '__none__')
 * @param level - 학교급 필터 값
 * @returns 함께 걸어도 되면 true (둘 중 하나가 전체면 늘 true)
 */
export function gradeFitsSchoolLevel(grade: string, level: SchoolLevelFilter): boolean {
  if (!level || !grade) return true;
  return levelFromGrade(grade) === level;
}

/**
 * 출처 행에서 학교급별로 학교 이름을 모은다 — 학교 칸을 학교급으로 좁힐 때 쓴다.
 *
 * 학년이 빈 행은 어느 학교급에도 넣지 않는다(필터도 그 행을 못 찾는다).
 * @param rows - 출처의 학교·학년
 * @returns 학교급 → 학교 이름들 (중복 없이 사전순)
 */
export function collectSchoolsByLevel(
  rows: readonly { school_name: string; grade: string }[],
): Record<SchoolLevel, string[]> {
  const sets: Record<SchoolLevel, Set<string>> = { 중등: new Set(), 고등: new Set() };
  for (const row of rows) {
    const level = levelFromGrade(row.grade);
    if (level && row.school_name) sets[level].add(row.school_name);
  }
  return { 중등: [...sets.중등].sort(), 고등: [...sets.고등].sort() };
}
