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

/** filters.ts 의 `UNSPECIFIED_AXIS` 와 같은 값 — 그 모듈을 부르면 순환하므로 값만 둔다 */
const UNSPECIFIED_AXIS_VALUE = '__none__';

/** 시험 구분 선택지. '' 는 미지정 */
export const EXAM_TYPE_OPTIONS = ['중간', '기말'] as const;

/**
 * 모의고사의 **회차** 선택지 — 같은 `exam_type` 칸에 담는다(중간·기말 자리).
 *
 * 전국 공통 시험이라 학교·학기가 없고, 같은 학년도 안에서 시험을 가르는 것이 회차뿐이다.
 * 기출 트리의 '모의고사·수능' 잎이 이 값으로 갈린다(school-exam-tree.ts).
 * ⚠️ DB CHECK(sql/55)와 **같은 목록**이어야 한다 — 한쪽에만 더하면 저장이 거절되거나
 *    화면에 없는 값이 생긴다.
 */
export const MOCK_EXAM_TYPE_OPTIONS = [
  '수능', '6월 모평', '9월 모평', '모평', '예비평가', '예비시행', '예시문항',
  '3월 학평', '4월 학평', '5월 학평', '6월 학평', '7월 학평', '9월 학평', '10월 학평', '11월 학평',
] as const;

/** 평가원 회차 — 전부 고3 시험이라 학년으로 가르지 않는다(기출 트리·잎 필터) */
const KICE_ROUNDS: readonly string[] = MOCK_EXAM_TYPE_OPTIONS.slice(0, 7);

/**
 * 평가원 회차인가 — 학년이 빈 출처와 '고3' 출처가 섞여도 한 시험으로 묶어야 한다.
 * 교육청 학평은 같은 달에 고1·고2·고3 이 따로 있어 학년이 곧 시험을 가른다.
 * @param examType - 회차
 * @returns 평가원 회차면 true
 */
export function isKiceRound(examType: string): boolean {
  return KICE_ROUNDS.includes(examType);
}

/**
 * 그 출처 유형에서 고를 수 있는 시험 구분.
 * @param type - 출처 유형 ('' 는 전체)
 * @returns 모의고사면 회차, 그 밖에는 중간·기말
 */
export function examTypeOptionsFor(type: string): readonly string[] {
  return type === '모의고사' ? MOCK_EXAM_TYPE_OPTIONS : EXAM_TYPE_OPTIONS;
}

/**
 * 유형을 바꿨을 때 지금 고른 시험 구분을 남겨도 되는가 — 새 유형의 선택지에 있어야 한다.
 * 모의고사 회차('수능')를 내신에 남기면 조건이 불가능한 조합이 되고, 내신의 '중간' 을
 * 모의고사에 남기면 회차 칸에 없는 값이 된다.
 * @param type - 새 유형 ('' = 전체면 무엇이든 남긴다)
 * @param examType - 지금 값 ('' 또는 '미지정만' 센티널은 늘 남긴다)
 * @returns 남겨도 되면 true
 */
export function examTypeFits(type: string, examType: string): boolean {
  if (!type || !examType || examType === UNSPECIFIED_AXIS_VALUE) return true;
  return examTypeOptionsFor(type).includes(examType);
}

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
  /**
   * 이 시험지에 실린 **작품** — 쉼표로 이어 적는다('봄봄, 동백꽃 (김유정)').
   *
   * ⚠️ **저장하지 않는다**(`SourceInsertPayload` 에 없다). OCR 프롬프트에 실어
   *    표기를 맞추게 하는 힌트일 뿐이고, 진짜 작품명은 읽어 낸 지문·문항에 붙는다.
   */
  works: string;
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
  const base: (keyof SourceFormValues)[] = [
    'source_type', 'level', 'title', 'year', 'grade', 'textbook', 'works',
  ];
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
