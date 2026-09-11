/**
 * 내신 시험범위 연동 타입 — ara-system public 스키마의 행 구조.
 * (학교/시험범위/교과서 마스터는 ara-system 이 단일 원본, 여기서는 읽기 전용)
 */

/** ara-system public.schools 행. level 은 한글('초등' | '중등' | '고등') */
export interface NaesinSchool {
  id: string;
  name: string;
  level: string;
}

/** public.school_exam_scopes 한 슬롯 (학교 × 학년 × 학년도 × 학기 × 중간/기말) */
export interface ScopeSlotRow {
  scope: string | null;
  teacher_name: string | null;
  textbook_id: string | null;
  /** 체크된 단원 키: "대단원제목" 또는 "대단원제목 > 소단원제목" 복합키 */
  units: string[];
  exam_start_date: string | null;
  exam_end_date: string | null;
  korean_exam_date: string | null;
  /**
   * 이 학교가 이 시험을 보지 않음(수행평가 대체 등, ara-system mig379).
   * ⚠️ ara-system 은 값 보존·잠금 방식이라 **true 여도 scope/units/교과서가 남아 있다** —
   * 범위를 쓰기 전에 이 플래그를 먼저 판정할 것.
   */
  noExam: boolean;
}

/**
 * public.school_exam_scopes 한 행 — **학교 단위로 전부** 읽을 때의 모양.
 *
 * `ScopeSlotRow` 가 슬롯 하나의 내용(범위·날짜)이라면, 이쪽은 어느 슬롯인지(학년·학년도·
 * 학기·시험)를 함께 든다. 기출 업로드가 폼 조건에 **가장 가까운** 슬롯의 교과서를 고를 때 쓴다.
 * ⚠️ `noExam` 이 true 인 행에도 `textbook_id` 가 남아 있다(ara-system mig379) — 교과서로 쓰지 말 것.
 */
export interface SchoolScopeRow {
  grade: string;
  year: number;
  semester: 1 | 2;
  exam_type: '중간' | '기말';
  textbook_id: string | null;
  units: string[];
  noExam: boolean;
}

/** public.curriculum_textbooks 행 (원본은 이 앱의 exam.publishers/major_chapters 마스터에서 동기화) */
export interface PublicTextbook {
  id: string;
  school_level: string | null;
  grade: string | null;
  publisher: string | null;
  book_title: string;
}

/** 시험범위 → 단어 카테고리 매칭 결과 */
export interface MatchOutcome {
  /** 자동 선택할 exam.categories id 목록 (dedupe 완료) */
  matchedIds: string[];
  /** 단어 카테고리에서 찾지 못한 단원 키 — 반드시 UI 에 표면화할 것 (조용한 유실 금지) */
  unmatchedUnits: string[];
}

/** 시험 슬롯 선택 옵션 (1학기 중간 ~ 2학기 기말) */
export interface ExamSlotOption {
  key: string;
  semester: 1 | 2;
  examType: '중간' | '기말';
  label: string;
}

export const EXAM_SLOT_OPTIONS: ExamSlotOption[] = [
  { key: '1-중간', semester: 1, examType: '중간', label: '1학기 중간고사' },
  { key: '1-기말', semester: 1, examType: '기말', label: '1학기 기말고사' },
  { key: '2-중간', semester: 2, examType: '중간', label: '2학기 중간고사' },
  { key: '2-기말', semester: 2, examType: '기말', label: '2학기 기말고사' },
];

/** 자유학기제로 1학기 시험이 없는 학년 */
export const FREE_SEMESTER_GRADE = '중1';

/**
 * 그 학년에서 고를 수 있는 시험 목록. 중1 은 자유학기제라 1학기 중간·기말이 없다.
 * ⚠️ ara-system app/lib/examScope.ts 의 `isSlotHiddenForGrade` 와 **같은 규칙의 교차 저장소 복제**다
 * (두 앱이 코드를 공유하지 않는다). 바꿀 땐 반드시 양쪽 함께 고칠 것.
 */
export const slotOptionsForGrade = (grade: string): ExamSlotOption[] =>
  grade === FREE_SEMESTER_GRADE
    ? EXAM_SLOT_OPTIONS.filter((o) => o.semester !== 1)
    : EXAM_SLOT_OPTIONS;
