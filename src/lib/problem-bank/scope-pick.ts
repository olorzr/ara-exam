import type { SchoolScopeRow } from '@/lib/naesin-scope/types';
import { levelFromGrade } from './source-form';

/**
 * 학교의 내신 범위 슬롯 가운데 폼 조건에 **가장 가까운** 것을 고른다 (순수 함수).
 *
 * 예전에는 학교·학년·학년도·학기·시험 다섯 키가 정확히 맞는 행 하나만 찾았다. 그러면
 * 2024 기출을 올릴 때 내신 관리에 2026 행만 있으면 아무것도 안 채워진다 — 학교를 고른
 * 순간 그 학교의 교과서는 사실상 정해져 있는데도 매번 손으로 골라야 했다.
 *
 * 그래서 학교만 맞으면 후보로 보고, 조건이 맞는 정도로 줄을 세운다. 무엇을 보고 골랐는지는
 * `ScopeBasis` 로 돌려줘 화면이 한 줄로 밝힌다(틀렸으면 선생님이 바꾸면 된다).
 */

/** 폼이 고른 조건. 미지정은 null / '' */
export interface ScopeWanted {
  /** '중2' 같은 학년. '' 는 미지정 */
  grade: string;
  year: number | null;
  semester: 1 | 2 | null;
  examType: '중간' | '기말' | null;
}

/** 교과서를 어느 슬롯에서 가져왔는가 */
export interface ScopeBasis {
  grade: string;
  year: number;
  semester: 1 | 2;
  examType: '중간' | '기말';
}

/** 학년도로 인정하는 표기 — 네 자리 숫자만 */
const YEAR_PATTERN = /^\d{4}$/;

/**
 * '1학기' 같은 표시값에서 학기 숫자를 뽑는다.
 * @param semester - 폼의 학기 값 ('' 는 미지정)
 * @returns 1 | 2. 미지정이면 null
 */
export function semesterDigit(semester: string): 1 | 2 | null {
  const m = (semester ?? '').match(/[12]/);
  if (!m) return null;
  return m[0] === '1' ? 1 : 2;
}

/**
 * 폼의 문자열 조건을 비교용 조건으로 바꾼다.
 *
 * ⚠️ 학년도는 **네 자리 숫자일 때만** 숫자다. `Number('')` 은 0 이라 그대로 두면 미지정을
 *    '0학년도' 로 조회한다(실제로 그렇게 돌고 있었다).
 * @param query - 폼 값 (표시값 그대로)
 * @returns 비교용 조건
 */
export function toScopeWanted(query: {
  grade: string; year: string; semester: string; examType: string;
}): ScopeWanted {
  const year = YEAR_PATTERN.test(query.year ?? '') ? Number(query.year) : null;
  const examType = query.examType === '중간' || query.examType === '기말' ? query.examType : null;
  return { grade: (query.grade ?? '').trim(), year, semester: semesterDigit(query.semester), examType };
}

/**
 * 다섯 키가 정확히 맞는 슬롯. 범위(단원)·'안 보는 시험' 판정은 이 슬롯으로만 한다.
 * @param rows - 그 학교의 슬롯 전부
 * @param wanted - 폼 조건
 * @returns 맞는 행. 조건이 하나라도 미지정이거나 없으면 null
 */
export function findExactSlot(
  rows: readonly SchoolScopeRow[],
  wanted: ScopeWanted,
): SchoolScopeRow | null {
  const { grade, year, semester, examType } = wanted;
  if (!grade || year === null || semester === null || examType === null) return null;
  return rows.find((r) => (
    r.grade === grade && r.year === year && r.semester === semester && r.exam_type === examType
  )) ?? null;
}

/**
 * 다른 학년의 슬롯에서 교과서를 빌려 와도 되는가.
 *
 * 중학교는 한 학교가 한 교과서를 쓴다(내신 관리가 그렇게 등록돼 있다). 고등학교는
 * 학년마다 책이 다르다(공통국어 ↔ 문학·독서) — 빌리면 틀린 책을 자신 있게 채우게 된다.
 * 학년을 아직 안 골랐으면 어느 학년의 행이든 힌트가 된다.
 * @param grade - 폼의 학년 ('' 는 미지정)
 * @returns 빌려도 되면 true
 */
export function canBorrowAcrossGrades(grade: string): boolean {
  return levelFromGrade(grade) !== '고등';
}

/**
 * 조건과 얼마나 어긋나는지 — 사전순으로 **작을수록** 가깝다.
 * 학년 일치 → 학년도 거리(가까운 해; 학년도 미지정이면 무시) → 학기 일치 → 시험 일치
 * → 최근 학년도 → 중간이 기말보다 먼저(ara-system 의 학기 대표 교과서 규칙과 같다).
 */
function rankKey(row: SchoolScopeRow, wanted: ScopeWanted): number[] {
  return [
    wanted.grade && row.grade !== wanted.grade ? 1 : 0,
    wanted.year === null ? 0 : Math.abs(row.year - wanted.year),
    wanted.semester !== null && row.semester !== wanted.semester ? 1 : 0,
    wanted.examType !== null && row.exam_type !== wanted.examType ? 1 : 0,
    -row.year,
    row.exam_type === '기말' ? 1 : 0,
  ];
}

/** 사전순 비교 — 음수면 a 가 앞 */
function compareKeys(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/**
 * 폼 조건에 가장 가까운, 교과서가 있는 슬롯을 고른다.
 *
 * 후보에서 빠지는 것: 교과서가 없는 행, '안 보는 시험'(값 보존·잠금이라 옛 교과서가 남는다),
 * 고등학교의 다른 학년 행.
 * @param rows - 그 학교의 슬롯 전부
 * @param wanted - 폼 조건
 * @returns 가장 가까운 행. 후보가 없으면 null
 */
export function pickTextbookRow(
  rows: readonly SchoolScopeRow[],
  wanted: ScopeWanted,
): SchoolScopeRow | null {
  const borrow = canBorrowAcrossGrades(wanted.grade);
  const candidates = rows.filter((r) => (
    r.textbook_id !== null && !r.noExam && (!wanted.grade || r.grade === wanted.grade || borrow)
  ));
  return candidates.reduce<SchoolScopeRow | null>((best, row) => (
    best === null || compareKeys(rankKey(row, wanted), rankKey(best, wanted)) < 0 ? row : best
  ), null);
}

/**
 * 기준 슬롯을 한 줄로 — '2026 중1 1학기 중간'.
 * @param basis - 기준 슬롯
 * @returns 표시 문자열
 */
export function describeBasis(basis: ScopeBasis): string {
  return `${basis.year} ${basis.grade} ${basis.semester}학기 ${basis.examType}`;
}

/**
 * 행에서 기준 정보만 뽑는다.
 * @param row - 고른 행
 * @returns 기준 슬롯
 */
export function toScopeBasis(row: SchoolScopeRow): ScopeBasis {
  return { grade: row.grade, year: row.year, semester: row.semester, examType: row.exam_type };
}
