export interface Word {
  id: string;
  word: string;
  meaning: string;
  category_id: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  level: '중등' | '고등' | '외부지문 및 프린트';
  /** 학년도. 외부지문에서만 사용하며 '' 는 미지정 */
  year: string;
  grade: string;
  publisher: string;
  semester: string;
  chapter: string;
  sub_chapter: string;
  school_name?: string;
  user_id: string;
  created_at: string;
}

export interface Exam {
  id: string;
  title: string;
  pass_percentage: number;
  total_questions: number;
  pass_count: number;
  category_ids: string[];
  word_ids: string[];
  parent_exam_id: string | null;
  retake_number: number;
  user_id: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string | null;
}

/** 감사 로그 */
export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  actor_id: string | null;
  actor_email: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

export interface ExamWord {
  id: string;
  exam_id: string;
  word_id: string;
  word: string;
  meaning: string;
  order_index: number;
}

export type CategoryLevel = '중등' | '고등' | '외부지문 및 프린트';

/** 출판사 마스터 (모든 사용자 공유) */
export interface Publisher {
  id: string;
  name: string;
  level: '중등' | '고등';
  created_at: string;
}

/** 대단원 마스터 (출판사 + 학년 + 학기별) */
export interface MajorChapter {
  id: string;
  name: string;
  publisher_id: string;
  grade: string;
  semester: string;
  created_at: string;
}

/** 소단원 마스터 (대단원별) */
export interface SubChapter {
  id: string;
  name: string;
  major_chapter_id: string;
  created_at: string;
}

/** 학교 마스터 (외부지문용, 모든 사용자 공유) */
export interface School {
  id: string;
  name: string;
  created_at: string;
}

/** 프린트/작품명 마스터 (학교 + 년도 + 학년별) */
export interface SchoolMaterial {
  id: string;
  name: string;
  school_id: string;
  /** 학년도. '' 는 미지정 */
  year: string;
  /** 학년(중1~고3). '' 는 미지정 */
  grade: string;
  created_at: string;
}

/**
 * 개념지 저장 데이터.
 * 카테고리는 `categories` 를 FK 로 참조하지 않고 텍스트로 복사 저장한다
 * (rename 은 sync_*_name 트리거가 따라온다 — CLAUDE.md 2026-06-16 참조).
 * 외부지문은 publisher/semester 대신 school_name/year 를 쓰고 unit 에 프린트/작품명이 들어간다.
 */
export interface ConceptSheet {
  id: string;
  title: string;
  level: CategoryLevel;
  /** 학년도. 외부지문에서만 사용하며 '' 는 미지정 */
  year: string;
  grade: string;
  publisher: string;
  semester: string;
  unit: string;
  subunit: string;
  /** 학교명. 외부지문에서만 사용 */
  school_name: string;
  editor_html: string;
  marks: { text: string; pos: number; len: number }[];
  /**
   * 합격 기준(%) — 단어 시험지(exams.pass_percentage)와 같은 뜻이다(sql/25, 기본 80).
   * 인쇄물 머리에 '합격 N개 이상 (P%)' 로 찍히고, 학원 관리 시스템으로 넘어가
   * 합격/불합격 판정(exam_results.passed)의 기준이 된다.
   */
  pass_percentage: number;
  /**
   * 학교 프린트 묶음에서 만든 개념지면 그 묶음 id (손으로 만든 개념지는 null).
   *
   * ⚠️ 개념지 목록은 이 값이 **NULL 인 행만** 보여 준다 — 프린트 시험지는 전용 메뉴
   *    (`/print-sheets`)에서만 보인다. 그래서 목록 조회 컬럼(`LIST_COLUMNS`)에 이 컬럼이
   *    반드시 있어야 한다. 빠뜨리면 타입엔 있는데 런타임엔 undefined 인 조용한 어긋남이다.
   */
  print_bundle_id: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * 개념지 목록/트리용 경량 타입. 무거운 `editor_html` 본문은 제외한다
 * (목록·카드·트리에서 쓰지 않으며, 상세 페이지 진입 시에만 별도 조회).
 */
// pass_percentage 도 뺀다 — 목록·트리는 합격 기준을 쓰지 않고, LIST_COLUMNS(조회 컬럼)와
// 타입을 맞춰 두어야 "타입엔 있는데 조회엔 없는" 조용한 undefined 가 안 생긴다.
export type ConceptSheetListItem = Omit<ConceptSheet, 'editor_html' | 'pass_percentage'>;

// 기출 문제 은행 (sql/17)
export * from './problem-bank';

// 학교 프린트 시험지 (sql/26)
export * from './print-scan';
