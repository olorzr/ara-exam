/**
 * 학교 프린트 시험지 도메인 타입.
 *
 * 시험지 자체는 `ConceptSheet`(concept_sheets) 다 — 여기 있는 것은 그 앞 단계,
 * 스캔 PDF 를 묶음으로 나눠 읽는 과정의 표들이다. 정의는 sql/26_print_scans.sql.
 */

/** 묶음의 읽기 상태 */
export type PrintBundleStatus = '대기' | '읽는중' | '읽기완료' | '실패';

/** 읽기 기록. 기출의 `OcrMeta` 와 달리 경고가 **문자열뿐**이다(가리킬 카드가 없다) */
export interface PrintOcrMeta {
  model?: string | null;
  effort?: string | null;
  /** 읽은 쪽 번호들 */
  pages?: number[];
  batches?: number;
  /** 실패한 묶음을 쪽 단위로 다시 읽은 횟수 */
  retries?: number;
  durationMs?: number;
  imagesSent?: number;
  /** 확인이 필요한 것들 (흐려서 못 읽은 자리·잘린 본문 등) */
  warnings?: string[];
  ranAt?: string;
}

/**
 * 단어 등록 영수증 — 몇 개 넣었고 무엇을 확인해야 하는가.
 *
 * ⚠️ `PrintOcrMeta` 에 합치지 않는다. '다시 읽기' 는 `ocr_meta` 를 통째로 덮어쓰는데
 *    단어 등록은 목록의 '단어 등록' 버튼으로 **따로** 돌 수 있어 수명이 다르다.
 */
export interface PrintWordsMeta {
  /** **마지막 시도**의 결과. done = 등록함 · empty = 뜻 있는 단어가 없음 · failed = 못 했음 */
  status?: 'done' | 'empty' | 'failed';
  /**
   * 이 프린트가 카테고리에 올려 둔 단어 수 — **누적값이고 줄지 않는다.**
   *
   * ⚠️ 마지막 시도의 숫자(`registered`/`skipped`)와 **반드시 따로 둔다.** 다시 등록하다
   *    실패하면 그 시도의 숫자는 0 인데 단어는 DB 에 그대로 있다. 한 칸으로 합치면
   *    실패 한 번에 칩·단어 관리 링크·삭제 안내가 통째로 사라진다(코덱스 리뷰 P2).
   */
  wordCount?: number;
  /** 마지막 시도에 실제로 들어간 단어 수 */
  registered?: number;
  /** 마지막 시도에 이미 있어서 건너뛴 수 */
  skipped?: number;
  /** 뜻이 안 적혀 있어 뺀 수 */
  noMeaning?: number;
  /** 뜻이 프린트에 없는 말이어서 뺀 수 (모델이 지어낸 풀이) */
  unverified?: number;
  /** 본문에 그 글자가 없어 뺀 수 */
  notInText?: number;
  /** 단어가 들어간 카테고리 — 목록에서 단어 관리로 건너뛸 때 쓴다. 한 번 정해지면 유지된다 */
  categoryId?: string | null;
  /** 사람이 확인해야 하는 것들 */
  warnings?: string[];
  ranAt?: string;
}

/** 업로드한 스캔 PDF 1건 */
export interface PrintScan {
  id: string;
  title: string;
  /** 원본 PDF 의 Storage 경로 — '다시 읽기' 가 이것에 달려 있다 */
  file_path: string;
  page_count: number;
  user_id: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

/** 묶음 = 프린트 한 장 = 개념지 한 장 */
export interface PrintBundle {
  id: string;
  scan_id: string;
  /** 프린트명 — 개념지의 unit 으로 복사된다 */
  name: string;
  /** 학교 마스터 id 스냅샷 (FK 아님) */
  school_id: string | null;
  school_name: string;
  /** 학년도. '' 가 미지정 */
  year: string;
  /** 학년('중2'). '' 가 미지정 */
  grade: string;
  /** 학기('1학기'·'2학기'). '' 가 미지정. 스캔 단위로 고른 값을 묶음마다 복사한다 */
  semester: string;
  /** 시험 구분('중간'·'기말'). '' 가 미지정 */
  exam_type: string;
  /** 손으로 적은 답·필기까지 옮길 것인가 */
  include_handwriting: boolean;
  /** 프린트에 적힌 '단어 — 뜻' 을 이 프린트 카테고리의 단어로 등록할 것인가 */
  register_words: boolean;
  /** 이 묶음이 덮는 원본 쪽 번호(1-based, 오름차순) */
  pages: number[];
  /** pages 와 **같은 순서**의 Storage 경로. 못 올린 쪽은 '' */
  page_paths: string[];
  /** 읽어 낸 원문(정화 완료) */
  ocr_html: string;
  ocr_meta: PrintOcrMeta;
  /** 단어 등록 영수증. 한 번도 안 돌렸으면 빈 객체다 */
  words_meta: PrintWordsMeta;
  status: PrintBundleStatus;
  user_id: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

/** 목록 화면이 쓰는 모양 — 묶음에 '그 묶음으로 만든 시험지' 를 붙여 둔다 */
export interface PrintBundleRow extends PrintBundle {
  /** 이 묶음의 개념지 id. 아직 안 만들었으면 null */
  sheetId: string | null;
  /** 그 개념지의 마킹 수 (목록에서 '빈칸 N개' 로 보여 준다) */
  markCount: number;
}

/** 스캔 하나와 그 묶음들 */
export interface PrintScanRow extends PrintScan {
  bundles: PrintBundleRow[];
}
