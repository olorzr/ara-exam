/**
 * 기출 문제 은행 타입 (sql/17_problem_bank.sql 미러).
 *
 * 분류 텍스트는 `categories` 관례를 따라 **빈 문자열이 "미지정"** 이다(NULL 아님).
 * 표시값 '미지정' ↔ 저장값 '' 변환은 `src/lib/external-category.ts` 한 곳에서만 한다.
 */

import type { OcrWarning } from '@/lib/problem-ocr/warnings';

/** 업로드한 원본 문서의 종류 */
export type ProblemSourceType = '내신기출' | '모의고사' | '문제집' | '프린트';

/** 출처 처리 단계. 업로드 → 추출중(OCR) → 검수중 → 완료 */
export type ProblemSourceStatus = '업로드' | '추출중' | '검수중' | '완료';

/** 문항 유형 */
export type QuestionType = '객관식' | '주관식' | '서술형';

/** 인쇄 방식. 'image' 면 본문 HTML 대신 잘라 둔 영역 이미지를 싣는다 */
export type RenderMode = 'text' | 'image';

/** 문항 검수 상태 */
export type ProblemStatus = '초안' | '검수완료';

/** 페이지 대비 정규화(0~1) 영역 좌표 */
export interface Bbox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** OCR 실행 기록. 감사 로그 대신 출처 행에 남긴다(대량 INSERT 감사를 피하려고) */
export interface OcrMeta {
  model?: string | null;
  effort?: string | null;
  /** 읽은 쪽 번호들 */
  pages?: number[];
  batches?: number;
  /** 실패한 묶음을 쪽 단위로 다시 읽은 횟수 — "왜 오래 걸렸나"를 설명한다 */
  retries?: number;
  durationMs?: number;
  imagesSent?: number;
  /**
   * 확인이 필요한 것들.
   *
   * ⚠️ 옛 출처에는 **문자열**이 들어 있다(대상 개념이 생기기 전에 저장된 행). 화면은
   *    두 모양을 모두 그려야 한다 — 객체만 받으면 옛 출처의 경고가 통째로 사라진다.
   */
  warnings?: OcrWarning[];
  /** 별도로 올린 답지 파일 수(사진이면 장수, PDF 면 쪽 수) — 검수 화면 요약용 */
  answerKeyFiles?: number;
  /** 실행 시각 (ISO) */
  ranAt?: string;
}

/** 업로드한 원본 문서 1건 */
export interface ProblemSource {
  id: string;
  source_type: ProblemSourceType;
  title: string;
  school_name: string;
  /**
   * 관리자시스템 `public.schools.id` 스냅샷. FK 가 아니다 —
   * 학교가 지워져도 기출은 남아야 하므로. 표시·필터는 계속 `school_name` 을 쓴다.
   */
  school_id: string | null;
  year: string;
  grade: string;
  semester: string;
  /** '' | '중간' | '기말' */
  exam_type: string;
  /** 문제집이면 출판사, 모의고사면 주관(교육청·평가원) */
  publisher: string;
  /** 교과서 = `exam.publishers.name` 이름 스냅샷. '' 는 미지정 */
  textbook: string;
  /** Storage 경로(버킷 exam-problem-bank 기준). 업로드 실패 시 '' */
  file_path: string;
  /**
   * 별도로 올린 답지 파일 경로들(`sources/{id}/answer-key/{n}.pdf|jpg`).
   * 원본 PDF 안에 붙어 있던 정답표 쪽은 여기가 아니라 `ocr_meta.pages` 에 있다.
   */
  answer_key_paths: string[];
  page_count: number;
  status: ProblemSourceStatus;
  ocr_meta: OcrMeta;
  notes: string;
  user_id: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

/** 여러 문항이 공유하는 지문 */
export interface Passage {
  id: string;
  source_id: string;
  /** 시험지에 인쇄된 머리글 범위 ('[1~3]') */
  label: string;
  /** 작품명 / 글 제목 */
  title: string;
  author: string;
  html: string;
  page_no: number;
  bbox: Bbox | null;
  image_path: string;
  render_mode: RenderMode;
  /** ara-system 영역 분류 마스터의 **이름 경로 스냅샷**(id 아님) */
  area_path: string[];
  /** 교과서 단원의 이름 경로 스냅샷 [대단원, 소단원] (최대 2단). 문항의 unit_path 와 같은 규약 */
  unit_path: string[];
  user_id: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

/** 문항 */
export interface Problem {
  id: string;
  source_id: string;
  passage_id: string | null;
  /** 원본 시험지의 문항 번호. 문제지로 조합하면 1..N 으로 다시 매긴다 */
  number: number | null;
  question_type: QuestionType;
  stem_html: string;
  /** 선지 본문 (①~⑤ 기호는 렌더에서 붙인다). 주관식·서술형은 빈 배열 */
  choices: string[];
  /** 객관식은 '1'~'5', 그 밖은 자유 텍스트. '' = 미입력 */
  answer: string;
  /**
   * 배점.
   * ⚠️ 2026-09-08 부터 **읽지도 보여 주지도 않는다** — OCR 이 채우지 않고 화면·인쇄에도
   *    나오지 않는다. 옛 행의 값을 잃지 않으려고 컬럼과 타입만 남겨 둔 자리다.
   */
  score: number | null;
  explanation_html: string;
  area_path: string[];
  /**
   * 교과서 단원의 **이름 경로 스냅샷** [대단원, 소단원] (최대 2단).
   * 마스터(`exam.major_chapters`/`sub_chapters`)의 id 가 아니다 — area_path 와 같은 이유로,
   * 마스터에서 이름이 바뀌거나 지워져도 이미 태깅한 문항이 흔들리면 안 된다.
   */
  unit_path: string[];
  /**
   * 문법 분류의 **이름 경로 스냅샷 목록**. 원소 하나가 경로 하나이고 `' > '` 로 잇는다
   * (예: `['단어 > 품사 > 명사', '문장 > 문법 요소 > 피동 표현']`).
   * ⚠️ area_path·unit_path 와 **모양이 다르다** — 그쪽은 배열 하나가 경로 하나라 한 개만
   *    붙지만, 수능 문법 문항은 개념 두셋을 걸친다. 마스터는 코드 상수(grammar-tree.ts).
   */
  grammar_paths: string[];
  work_title: string;
  tags: string[];
  page_no: number;
  bbox: Bbox | null;
  image_path: string;
  figure_paths: string[];
  render_mode: RenderMode;
  status: ProblemStatus;
  verified_by: string | null;
  verified_at: string | null;
  /** 검색용 평문. DB 트리거가 채운다 — 앱에서 보내지 말 것 */
  search_text: string;
  user_id: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

/** 문제지 인쇄 설정. RPC 가 화이트리스트로 재조립한 값만 저장된다 */
export interface PaperSettings {
  columns: 1 | 2;
  /**
   * @deprecated 배점을 인쇄하지 않는다(2026-09-08). 렌더러는 이 값을 보지 않는다.
   * DB RPC `create_problem_paper` 가 저장할 때마다 이 키를 화이트리스트로 다시 조립하고
   * 이미 만든 문제지에 `true` 가 들어 있어, 타입에서 빼면 저장된 행과 어긋난다.
   */
  showScore: boolean;
  showSource: boolean;
}

/** 조합한 문제지 */
export interface ProblemPaper {
  id: string;
  title: string;
  settings: PaperSettings;
  source_labels: string[];
  total_questions: number;
  user_id: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

/** 문제지 항목의 지문 스냅샷 */
export interface PaperPassageSnapshot {
  id: string;
  label: string;
  title: string;
  author: string;
  html: string;
  render_mode: RenderMode;
  image_path: string;
}

/** 문제지 항목의 출처 스냅샷 (머리말 표시용) */
export interface PaperSourceSnapshot {
  source_type: ProblemSourceType;
  title: string;
  school_name: string;
  year: string;
  grade: string;
  exam_type: string;
  publisher: string;
}

/**
 * 문제지 항목의 본문 스냅샷.
 * 원본 문항을 고치거나 지워도 이미 만든 문제지는 이 값으로 계속 인쇄된다
 * (exam_words 와 같은 규약).
 */
export interface PaperItemSnapshot {
  number: number | null;
  question_type: QuestionType;
  stem_html: string;
  choices: string[];
  answer: string;
  score: number | null;
  explanation_html: string;
  area_path: string[];
  work_title: string;
  render_mode: RenderMode;
  image_path: string;
  figure_paths: string[];
  passage: PaperPassageSnapshot | null;
  source: PaperSourceSnapshot;
}

/** 문제지에 담긴 항목 한 개 */
export interface ProblemPaperItem {
  id: string;
  paper_id: string;
  order_index: number;
  /** 원본이 지워지면 null 이 된다(스냅샷은 남는다) */
  problem_id: string | null;
  passage_id: string | null;
  snapshot: PaperItemSnapshot;
  created_at: string;
}
