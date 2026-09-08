import { normalizeCategoryName } from '@/lib/category-name';
import { HIGH_SCHOOL_GRADES, MIDDLE_SCHOOL_GRADES } from '@/lib/constants';
import { toStoredValue, UNSPECIFIED_OPTION } from '@/lib/external-category';
import type { ProblemSourceType } from '@/types/problem-bank';

/**
 * 기출 업로드 폼의 검증·정규화 (순수 함수).
 *
 * ⚠️ 학교명은 반드시 `normalizeCategoryName` 을 거쳐 저장한다.
 *    DB 제약과 목록 묶기가 전부 **바이트 비교**라, 눈에 똑같은 `상현중` / `상현중 `이
 *    따로 쌓여 필터가 둘로 갈라진다(카테고리에서 실제로 겪은 문제다).
 *
 * ⚠️ 분류값의 `''` 는 NULL 이 아니라 **"미지정"** 이다(categories 와 같은 규약).
 */

/** 출처 유형 선택지 — 화면 순서가 곧 이 순서다 */
export const SOURCE_TYPE_OPTIONS: ProblemSourceType[] = ['내신기출', '모의고사', '문제집', '프린트'];

/** 시험 구분 선택지. '' 는 미지정 */
export const EXAM_TYPE_OPTIONS = ['중간', '기말'] as const;

/**
 * 학교급.
 *
 * ⚠️ **저장하지 않는다.** 폼에서 학교·학년 선택지를 좁히는 데만 쓰고, DB 에서는
 *    `grade`('중2')의 접두사로 되찾는다(`levelFromGrade`). 저장하면 '중1인데 고등' 처럼
 *    어긋난 행이 생겨 CHECK 로 또 막아야 한다(ara-system mig420 과 같은 판단).
 */
export type SchoolLevel = '중등' | '고등';

/** 학교급 선택지 — 화면 순서가 곧 이 순서다 */
export const SCHOOL_LEVEL_OPTIONS: readonly SchoolLevel[] = ['중등', '고등'];

/**
 * 그 학교급에서 고를 수 있는 학년.
 * @param level - 학교급
 * @returns 학년 선택지 (+ '미지정')
 */
export function gradeOptionsForLevel(level: SchoolLevel): string[] {
  const grades = level === '고등' ? HIGH_SCHOOL_GRADES : MIDDLE_SCHOOL_GRADES;
  return [...grades, UNSPECIFIED_OPTION];
}

/**
 * 학년에서 학교급을 되찾는다. 저장된 출처에는 학교급 컬럼이 없다.
 * @param grade - '중2' 같은 학년 ('' 는 미지정)
 * @returns 학교급. 알 수 없으면 null
 */
export function levelFromGrade(grade: string): SchoolLevel | null {
  const g = (grade ?? '').trim();
  if (g.startsWith('중')) return '중등';
  if (g.startsWith('고')) return '고등';
  return null;
}

/** 화면이 들고 있는 값 (표시값 그대로 — '미지정' 센티널을 포함할 수 있다) */
export interface SourceFormValues {
  source_type: ProblemSourceType;
  /** 학교급 — 저장하지 않고 학교·학년 선택지를 좁히는 데만 쓴다 */
  level: SchoolLevel;
  title: string;
  school_name: string;
  /** 관리자시스템 public.schools.id. 손으로 적은 학교면 '' */
  school_id: string;
  /** 교과서(= exam.publishers.name). '' 는 미지정 */
  textbook: string;
  year: string;
  grade: string;
  semester: string;
  exam_type: string;
  publisher: string;
}

/** DB 에 넣을 형태 (학교급은 없다 — 학년에서 파생한다) */
export interface SourceInsertPayload {
  source_type: ProblemSourceType;
  title: string;
  school_name: string;
  /** FK 가 아니다 — 학교가 지워져도 기출은 남는다 */
  school_id: string | null;
  textbook: string;
  year: string;
  grade: string;
  semester: string;
  exam_type: string;
  publisher: string;
}

/** 필드별 오류 메시지. 비어 있으면 통과 */
export type SourceFormErrors = Partial<Record<keyof SourceFormValues, string>>;

/**
 * 유형에 따라 학교명을 요구할지.
 * 내신 기출은 학교가 곧 출처라 없으면 나중에 아무도 못 찾는다.
 * @param type - 출처 유형
 * @returns 학교명이 필수면 true
 */
export function requiresSchool(type: ProblemSourceType): boolean {
  return type === '내신기출';
}

/**
 * 폼 값을 검증한다.
 * @param values - 화면 값
 * @returns 필드별 오류 (없으면 빈 객체)
 */
export function validateSourceForm(values: SourceFormValues): SourceFormErrors {
  const errors: SourceFormErrors = {};

  if (!values.title.trim()) {
    errors.title = '제목을 입력해 주세요.';
  } else if (values.title.trim().length > 120) {
    errors.title = '제목이 너무 길어요(120자 이내).';
  }

  if (requiresSchool(values.source_type) && !toStoredValue(values.school_name).trim()) {
    errors.school_name = '내신 기출은 학교를 골라 주세요.';
  }

  const year = toStoredValue(values.year);
  if (year && !/^\d{4}$/.test(year)) {
    errors.year = '학년도는 네 자리 숫자로 입력해 주세요.';
  }

  return errors;
}

/**
 * 폼 값을 DB 저장 형태로 바꾼다.
 *
 * 이름 필드는 정규화하고, '미지정' 센티널은 빈 문자열로 되돌린다.
 * @param values - 화면 값
 * @returns INSERT 페이로드 (user_id 는 DB 트리거가 채우므로 넣지 않는다)
 */
export function toSourcePayload(values: SourceFormValues): SourceInsertPayload {
  return {
    source_type: values.source_type,
    title: normalizeCategoryName(values.title),
    school_name: normalizeCategoryName(toStoredValue(values.school_name)),
    year: toStoredValue(values.year).trim(),
    grade: toStoredValue(values.grade).trim(),
    semester: toStoredValue(values.semester).trim(),
    exam_type: toStoredValue(values.exam_type).trim(),
    publisher: normalizeCategoryName(toStoredValue(values.publisher)),
    school_id: values.school_id || null,
    textbook: normalizeCategoryName(toStoredValue(values.textbook)),
  };
}

/**
 * 유형별로 화면에 보여 줄 필드를 정한다.
 * 문제집에 '학교'를 물으면 빈 칸만 늘고, 내신에 '출판사'를 물으면 헷갈린다.
 * @param type - 출처 유형
 * @returns 보여 줄 필드 이름 목록
 */
export function visibleFields(type: ProblemSourceType): (keyof SourceFormValues)[] {
  // 학교급·교과서는 유형과 무관하게 묻는다 — 학교급은 학년·학교 목록을 좁히고,
  // 교과서는 어느 유형이든 단원별로 찾을 수 있어야 하기 때문이다
  const base: (keyof SourceFormValues)[] = ['source_type', 'level', 'title', 'year', 'grade', 'textbook'];
  if (type === '내신기출') return [...base, 'school_name', 'semester', 'exam_type'];
  if (type === '모의고사') return [...base, 'publisher'];
  if (type === '문제집') return [...base, 'publisher'];
  return [...base, 'school_name'];
}

/**
 * 제목을 비워 뒀을 때 채워 줄 기본값.
 * @param values - 지금까지 고른 값
 * @returns 제안 제목 (만들 수 없으면 빈 문자열)
 */
export function suggestTitle(values: SourceFormValues): string {
  const parts = [
    toStoredValue(values.year),
    toStoredValue(values.school_name) || toStoredValue(values.publisher),
    toStoredValue(values.grade),
    toStoredValue(values.semester),
    toStoredValue(values.exam_type),
  ].filter(Boolean);
  if (parts.length === 0) return '';
  return normalizeCategoryName(parts.join(' '));
}

/**
 * 폼 값 하나를 고친 결과 (제목 자동 채움 규칙 포함).
 *
 * 제목은 **선생님이 직접 치기 전까지** `suggestTitle` 을 따라간다. 예전에는 '…로 채우기'
 * 버튼을 눌러야 했는데, 안 누르고 넘어가면 제목이 비어 검증에 걸렸다.
 * 직접 치면 자동을 끄고(치는 대로 둔다), 칸을 비우면 다시 켠다.
 *
 * 학교급을 바꾸면 **학교·학년·교과서를 비운다** — 다른 급의 학교가 남아 있으면
 * 목록에 없는 값이 선택된 채로 저장된다.
 * @param values - 지금 값
 * @param patch - 바꿀 값
 * @param titleAuto - 지금까지 제목을 자동으로 채우고 있었는가
 * @returns 새 값과 새 자동 여부
 */
export function applySourcePatch(
  values: SourceFormValues,
  patch: Partial<SourceFormValues>,
  titleAuto: boolean,
): { values: SourceFormValues; titleAuto: boolean } {
  const levelChanged = patch.level !== undefined && patch.level !== values.level;
  const cleared: Partial<SourceFormValues> = levelChanged
    ? { school_id: '', school_name: '', grade: '', textbook: '' }
    : {};

  const nextAuto = patch.title === undefined ? titleAuto : patch.title.trim() === '';
  const merged: SourceFormValues = { ...values, ...cleared, ...patch };

  return {
    values: nextAuto ? { ...merged, title: suggestTitle(merged) } : merged,
    titleAuto: nextAuto,
  };
}
