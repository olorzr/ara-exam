import type { BuilderCategory, MarkItem } from '@/components/exam-builder';
import { EXTERNAL_LEVEL } from './constants';
import { normalizeCategoryName } from './category-name';
import type { ConceptSheet } from '@/types';

/** 개념지가 저장하는 컬럼 중 편집기가 채우는 부분 (id·user_id·타임스탬프 제외) */
export type ConceptSheetPayload = Pick<
  ConceptSheet,
  | 'title' | 'level' | 'year' | 'grade' | 'publisher'
  | 'semester' | 'unit' | 'subunit' | 'school_name' | 'editor_html' | 'marks'
>;

/** 새 개념지의 빈 카테고리 */
export const DEFAULT_CONCEPT_CATEGORY: BuilderCategory = {
  level: '중등',
  year: '',
  grade: '',
  publisher: '',
  semester: '',
  unit: '',
  subunit: '',
  schoolName: '',
};

/** 제목이 비었을 때 대신 저장하는 값 */
export const UNTITLED_CONCEPT_TITLE = '제목 없음';

/**
 * 카테고리 값으로 개념지 자동 제목을 만든다.
 * 외부지문은 출판사/학기가 없어 학교명·년도를 대신 쓴다.
 *
 * @param cat - 빌더 카테고리
 * @returns `"중1 비상(김진수) 1학기 1단원 개념지"` 형태. 채워진 값이 없으면 빈 문자열
 */
export function generateConceptTitle(cat: BuilderCategory): string {
  const parts = cat.level === EXTERNAL_LEVEL
    ? [cat.schoolName, cat.year, cat.grade, cat.unit]
    : [cat.grade, cat.publisher, cat.semester, cat.unit, cat.subunit];
  const filled = parts.filter(Boolean);
  return filled.length > 0 ? `${filled.join(' ')} 개념지` : '';
}

/**
 * 저장에 필요한 카테고리 항목이 비었는지 판정한다.
 *
 * level 인지형이어야 한다 — 외부지문은 출판사/학기를 쓰지 않으므로, 예전처럼
 * `grade` + `publisher` 를 무조건 요구하면 외부지문을 고를 수 있어도 저장이 막힌다.
 * `unit` 은 양쪽 모두 필수다. 빠지면 인쇄 제목이 `"2026  국어 "` 처럼 공백만 남는다.
 *
 * @param cat - 빌더 카테고리
 * @returns 필수 항목이 하나라도 비었으면 true
 */
export function isCategoryIncomplete(cat: BuilderCategory): boolean {
  if (cat.level === EXTERNAL_LEVEL) {
    return !cat.schoolName || !cat.unit;
  }
  return !cat.grade || !cat.publisher || !cat.unit;
}

/**
 * concept_sheets 에 쓸 저장 payload 를 만든다.
 *
 * 이름 필드는 `normalizeCategoryName` 으로 정규화한다. 트리에서 고른 값이라 대개
 * 이미 정규형이지만, 표기 변형이 섞여 들어오면 개념지만 다른 폴더로 갈라진다.
 *
 * @param input.title - 사용자가 입력한 제목(공백만 있으면 '제목 없음')
 * @param input.category - 빌더 카테고리
 * @param input.html - 이미 sanitize 된 편집기 HTML
 * @param input.marks - 추출된 개념 마킹 목록
 * @returns Supabase insert/update 에 그대로 넘길 수 있는 payload
 */
export function buildConceptSheetPayload(input: {
  title: string;
  category: BuilderCategory;
  html: string;
  marks: MarkItem[];
}): ConceptSheetPayload {
  const { title, category, html, marks } = input;
  return {
    title: title.trim() || UNTITLED_CONCEPT_TITLE,
    level: category.level,
    year: category.year,
    grade: category.grade,
    publisher: normalizeCategoryName(category.publisher),
    semester: category.semester,
    unit: normalizeCategoryName(category.unit),
    subunit: normalizeCategoryName(category.subunit),
    school_name: normalizeCategoryName(category.schoolName),
    editor_html: html,
    marks,
  };
}
