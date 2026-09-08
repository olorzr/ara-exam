import { normalizeCategoryName } from '@/lib/category-name';
import { toStoredValue } from '@/lib/external-category';
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

/** 화면이 들고 있는 값 (표시값 그대로 — '미지정' 센티널을 포함할 수 있다) */
export interface SourceFormValues {
  source_type: ProblemSourceType;
  title: string;
  school_name: string;
  year: string;
  grade: string;
  semester: string;
  exam_type: string;
  publisher: string;
}

/** DB 에 넣을 형태 */
export interface SourceInsertPayload {
  source_type: ProblemSourceType;
  title: string;
  school_name: string;
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
  };
}

/**
 * 유형별로 화면에 보여 줄 필드를 정한다.
 * 문제집에 '학교'를 물으면 빈 칸만 늘고, 내신에 '출판사'를 물으면 헷갈린다.
 * @param type - 출처 유형
 * @returns 보여 줄 필드 이름 목록
 */
export function visibleFields(type: ProblemSourceType): (keyof SourceFormValues)[] {
  const base: (keyof SourceFormValues)[] = ['source_type', 'title', 'year', 'grade'];
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
