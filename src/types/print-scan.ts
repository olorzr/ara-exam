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
  /** 손으로 적은 답·필기까지 옮길 것인가 */
  include_handwriting: boolean;
  /** 이 묶음이 덮는 원본 쪽 번호(1-based, 오름차순) */
  pages: number[];
  /** pages 와 **같은 순서**의 Storage 경로. 못 올린 쪽은 '' */
  page_paths: string[];
  /** 읽어 낸 원문(정화 완료) */
  ocr_html: string;
  ocr_meta: PrintOcrMeta;
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
