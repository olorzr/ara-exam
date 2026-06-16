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

/** 프린트/작품명 마스터 (학교별) */
export interface SchoolMaterial {
  id: string;
  name: string;
  school_id: string;
  created_at: string;
}

/** 개념지 저장 데이터 */
export interface ConceptSheet {
  id: string;
  title: string;
  level: '중등' | '고등';
  grade: string;
  publisher: string;
  semester: string;
  unit: string;
  subunit: string;
  editor_html: string;
  marks: { text: string; pos: number; len: number }[];
  user_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * 개념지 목록/트리용 경량 타입. 무거운 `editor_html` 본문은 제외한다
 * (목록·카드·트리에서 쓰지 않으며, 상세 페이지 진입 시에만 별도 조회).
 */
export type ConceptSheetListItem = Omit<ConceptSheet, 'editor_html'>;
