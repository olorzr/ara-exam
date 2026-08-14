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
