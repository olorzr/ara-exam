import { HIGH_SCHOOL_GRADES, MIDDLE_SCHOOL_GRADES, SEMESTER_OPTIONS } from '@/lib/constants';
import type { ProblemSource } from '@/types/problem-bank';
import { mockExamGrade, ROUND_ORDER } from './mock-exam-tree';
import { MOCK_EXAM_SOURCE_TYPE } from './school-exam-tree';
import { EXAM_TYPE_OPTIONS, levelFromGrade, type SchoolLevel } from './source-form';
import { isSetSourceType, type SetSourceType, type SourceSetRow } from './source-sets-payload';

/**
 * 기출 세트 (순수 함수) — 화면 `/problems/sets` 의 묶음·차례·카드 글귀.
 *
 * 세트의 뜻은 기출 공유 사이트(exam-share 의 browse_slots)와 같다(2026-11-13 원장님 요청):
 *  - 내신기출: 학년도·학년·학기·시험·교과서가 같고 **학교만 다른** 시험들
 *  - 모의고사: 학년도·학년·회차·주관이 같은 **과목들**
 * ⚠️ 평가원 회차는 학년이 빈 출처와 '고3' 출처를 **한 세트**로 합친다 — 기출 트리(school-exam-tree.ts)와 같은 판단이고,
 *    회차 목록이 TS(`isKiceRound`)에 있어 SQL(sql/107)이 아니라 여기서 합친다.
 * ⚠️ 열쇠는 `JSON.stringify` 배열이다 — 학교·교과서 이름은 자유 텍스트라 `'|'` 같은 구분자는 이름에 섞이면 갈라진다.
 */

/** 세트를 가르는 칸 — 주소·조회 조건이 이것만 싣는다 */
export interface SourceSetKey {
  source_type: SetSourceType;
  year: string;
  /** 평가원 회차는 늘 '고3'(학년이 빈 출처도 같은 세트다) */
  grade: string;
  semester: string;
  exam_type: string;
  textbook: string;
  publisher: string;
}

/** 세트 한 장 */
export interface SourceSet extends SourceSetKey {
  /** 출처 행 수 */
  exam_count: number;
  /** 내신은 학교 이름(가나다), 모의고사는 출처 제목(공통 과목 먼저) */
  names: string[];
}

/** 카드에 이름을 몇 개까지 적는가 — 넘치면 ' 외' */
export const SET_NAMES_SHOWN = 4;

/** 학년 차례 — 중1 … 고3, 목록 밖·빈 학년은 맨 뒤 */
const GRADE_ORDER: readonly string[] = [...MIDDLE_SCHOOL_GRADES, ...HIGH_SCHOOL_GRADES];

/** 최근 학년도부터, 빈 학년도는 맨 뒤 */
function compareYearDesc(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return b.localeCompare(a);
}

/** 내신 학기 차례 — 늦은 학기부터, 목록 밖·빈 학기는 맨 뒤 */
const LATEST_SEMESTER_FIRST: readonly string[] = [...SEMESTER_OPTIONS].reverse();

/** 내신 시험 차례 — 기말이 중간보다 먼저 */
const LATEST_EXAM_FIRST: readonly string[] = [...EXAM_TYPE_OPTIONS].reverse();

/** 모의고사 과목 가운데 맨 앞에 둘 것 — 제목에 괄호가 없으면 '국어' 다 */
const COMMON_SUBJECTS: readonly string[] = ['공통', '국어'];

/** 목록 순위 — 없으면 맨 뒤 */
function rankIn(order: readonly string[], value: string): number {
  const index = order.indexOf(value);
  return index >= 0 ? index : order.length;
}

/** 빈 값을 뒤로 보내는 가나다 비교 */
function compareText(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b, 'ko');
}

/**
 * 모의고사 과목 — 제목 끝 괄호 안 글자(기출 공유 사이트 bank-reader.ts 의 mockSubject 와 같은 규칙).
 * @param title - '2027학년도 6월 모평 (화법과 작문)'
 * @returns '화법과 작문'. 괄호가 없으면 '국어'
 */
export function mockSubject(title: string): string {
  const match = /\(([^()]+)\)\s*$/.exec(title.trim());
  return match ? match[1].trim() : '국어';
}

/** 모의고사 과목 차례 — 공통(국어)이 먼저, 나머지는 가나다 */
function compareSubjects(a: string, b: string): number {
  const rank = Number(!COMMON_SUBJECTS.includes(a)) - Number(!COMMON_SUBJECTS.includes(b));
  return rank !== 0 ? rank : compareText(a, b);
}

/** 세트 이름들의 차례 — 내신은 학교 가나다, 모의고사는 과목 차례 */
function sortNames(type: SetSourceType, names: Iterable<string>): string[] {
  const unique = [...new Set(names)];
  if (type === MOCK_EXAM_SOURCE_TYPE) {
    return unique.sort((a, b) => compareSubjects(mockSubject(a), mockSubject(b)) || compareText(a, b));
  }
  return unique.sort(compareText);
}

/**
 * 세트 열쇠.
 * @param set - 세트를 가르는 칸
 * @returns 같은 세트면 같은 글자
 */
export function sourceSetKey(set: SourceSetKey): string {
  return JSON.stringify([
    set.source_type, set.year, set.grade, set.semester, set.exam_type, set.textbook, set.publisher,
  ]);
}

/**
 * 서버 행을 세트로 — 평가원 회차의 학년을 '고3' 으로 맞춰 합치고 이름을 정렬한다.
 * @param rows - `parseSourceSets` 결과
 * @returns 세트들 (차례는 `compareSourceSets` 로 정한다)
 */
export function toSourceSets(rows: readonly SourceSetRow[]): SourceSet[] {
  const merged = new Map<string, SourceSet>();
  for (const row of rows) {
    const grade = row.source_type === MOCK_EXAM_SOURCE_TYPE ? mockExamGrade(row) : row.grade;
    const key: SourceSetKey = { ...pickKey(row), grade };
    const id = sourceSetKey(key);
    const seen = merged.get(id);
    if (seen) {
      seen.exam_count += row.exam_count;
      seen.names = sortNames(key.source_type, [...seen.names, ...row.names]);
      continue;
    }
    merged.set(id, { ...key, exam_count: row.exam_count, names: sortNames(key.source_type, row.names) });
  }
  return [...merged.values()];
}

/** 세트를 가르는 칸만 */
function pickKey(set: SourceSetKey): SourceSetKey {
  return {
    source_type: set.source_type, year: set.year, grade: set.grade, semester: set.semester,
    exam_type: set.exam_type, textbook: set.textbook, publisher: set.publisher,
  };
}

/**
 * 세트 차례 — 내신이 먼저, 최근 학년도부터, 학년(중1 … 고3), 그다음 내신은 **늦은 시험부터**(2학기 → 1학기, 기말 → 중간)
 * → 교과서(미지정은 뒤), 모의고사는 회차(수능 먼저, 늦은 달부터 — 기출 트리의 ROUND_ORDER) → 주관.
 * 학년도를 최근부터 두는 것과 같은 결이다 — 방금 본 시험이 학년 묶음의 맨 앞에 온다.
 * @param a - 세트
 * @param b - 세트
 * @returns 정렬 비교값
 */
export function compareSourceSets(a: SourceSetKey, b: SourceSetKey): number {
  const mockA = a.source_type === MOCK_EXAM_SOURCE_TYPE;
  const mockB = b.source_type === MOCK_EXAM_SOURCE_TYPE;
  if (mockA !== mockB) return mockA ? 1 : -1;
  return (
    compareYearDesc(a.year, b.year)
    || rankIn(GRADE_ORDER, a.grade) - rankIn(GRADE_ORDER, b.grade)
    || (mockA
      ? rankIn(ROUND_ORDER, a.exam_type) - rankIn(ROUND_ORDER, b.exam_type)
        || compareText(a.exam_type, b.exam_type) || compareText(a.publisher, b.publisher)
      : rankIn(LATEST_SEMESTER_FIRST, a.semester) - rankIn(LATEST_SEMESTER_FIRST, b.semester)
        || rankIn(LATEST_EXAM_FIRST, a.exam_type) - rankIn(LATEST_EXAM_FIRST, b.exam_type)
        || compareText(a.textbook, b.textbook))
  );
}

/**
 * 카드 번호.
 * @param n - 1부터
 * @returns '#01'
 */
export function setIssueNo(n: number): string {
  return `#${String(n).padStart(2, '0')}`;
}

/**
 * 시험 이름.
 * @param set - 세트
 * @returns 내신 '1학기 중간고사', 모의고사는 회차 그대로('9월 모평')
 */
export function setExamLabel(set: Pick<SourceSetKey, 'source_type' | 'semester' | 'exam_type'>): string {
  if (set.source_type === MOCK_EXAM_SOURCE_TYPE) return set.exam_type || '회차 미지정';
  const exam = set.exam_type ? `${set.exam_type}고사` : '시험 미지정';
  return set.semester ? `${set.semester} ${exam}` : exam;
}

/**
 * 교과서(내신) 또는 주관(모의고사) 한 줄.
 * @param set - 세트
 * @returns 빈 값이면 '교과서 미지정' · '주관 미지정'
 */
export function setTextbookLabel(set: Pick<SourceSetKey, 'source_type' | 'textbook' | 'publisher'>): string {
  if (set.source_type === MOCK_EXAM_SOURCE_TYPE) return set.publisher || '주관 미지정';
  return set.textbook || '교과서 미지정';
}

/**
 * 카드의 이름 줄 — 내신은 'N곳 · 학교, 학교 외', 모의고사는 '과목, 과목'.
 *
 * 학교 이름으로 찾는 중이면 맞은 이름을 앞에 세운다 — 다섯째 뒤에 걸린 학교가 카드에서 안 보이면 왜 걸렸는지 모른다.
 * @param set - 세트
 * @param match - 맞은 이름을 고르는 함수(찾는 중일 때만)
 * @returns 한 줄
 */
export function setNamesSummary(set: Pick<SourceSet, 'source_type' | 'names'>, match?: (name: string) => boolean): string {
  const mock = set.source_type === MOCK_EXAM_SOURCE_TYPE;
  const ordered = match
    ? [...set.names.filter((n) => match(n)), ...set.names.filter((n) => !match(n))]
    : set.names;
  const labels = ordered.map((n) => (mock ? mockSubject(n) : n));
  const shown = labels.slice(0, SET_NAMES_SHOWN).join(', ');
  const more = labels.length > SET_NAMES_SHOWN ? ' 외' : '';
  return mock ? `${shown}${more}` : `${set.names.length}곳 · ${shown}${more}`;
}

/**
 * 세트의 학교급 — 목록의 '구분' 거르기에 쓴다.
 * @param set - 세트
 * @returns 내신이면 학년의 학교급(모르면 null), 모의고사면 '모의고사'
 */
export function setLevel(set: Pick<SourceSetKey, 'source_type' | 'grade'>): SchoolLevel | '모의고사' | null {
  return set.source_type === MOCK_EXAM_SOURCE_TYPE ? '모의고사' : levelFromGrade(set.grade);
}

/**
 * 출처 한 건이 든 세트 — 시험 보기 화면의 '이 세트로 돌아가기' 에 쓴다.
 * @param source - 출처
 * @returns 세트 칸. 내신기출·모의고사가 아니면 null
 */
export function sourceSetOf(
  source: Pick<ProblemSource, 'source_type' | 'year' | 'grade' | 'semester' | 'exam_type' | 'textbook' | 'publisher'>,
): SourceSetKey | null {
  if (!isSetSourceType(source.source_type)) return null;
  if (source.source_type === MOCK_EXAM_SOURCE_TYPE) {
    return {
      source_type: source.source_type, year: source.year ?? '', grade: mockExamGrade(source),
      semester: '', exam_type: source.exam_type ?? '', textbook: '', publisher: source.publisher ?? '',
    };
  }
  return {
    source_type: source.source_type, year: source.year ?? '', grade: source.grade ?? '',
    semester: source.semester ?? '', exam_type: source.exam_type ?? '', textbook: source.textbook ?? '', publisher: '',
  };
}

/**
 * 세트 한 장 안의 출처 차례 — 내신은 학교 가나다 → 제목, 모의고사는 과목 차례.
 * @param rows - 그 세트의 출처들
 * @returns 정렬한 새 배열
 */
export function orderSetSources<T extends Pick<ProblemSource, 'source_type' | 'school_name' | 'title' | 'id'>>(
  rows: readonly T[],
): T[] {
  return [...rows].sort((a, b) => {
    if (a.source_type === MOCK_EXAM_SOURCE_TYPE && b.source_type === MOCK_EXAM_SOURCE_TYPE) {
      return compareSubjects(mockSubject(a.title), mockSubject(b.title)) || compareText(a.title, b.title)
        || compareText(a.id, b.id);
    }
    return compareText(a.school_name, b.school_name) || compareText(a.title, b.title) || compareText(a.id, b.id);
  });
}
