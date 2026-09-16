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
  /** 예산을 맞추느라 **화질을 낮춰** 보낸 쪽 (경고와 짝이다) */
  degradedPages?: number[];
  /** PDF 글자 레이어를 참고 텍스트로 얼마나 썼는가. 스캔본은 'none' 이 정상이다 */
  textSource?: 'layer' | 'partial' | 'none';
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

/**
 * 문답 시험지에서 **답이 어디서 왔는가**.
 *
 * 인쇄물마다 다르게 다뤄야 해서 하나로 뭉뚱그릴 수 없다 — 선생님이 인쇄해 둔 답과
 * 학생이 연필로 적은 답은 믿을 만한 정도가 전혀 다르고(그래서 모범답안 대상이 갈린다),
 * AI 가 만든 답은 교사용에 **근거와 함께** 찍어야 선생님이 확인하고 고칠 수 있다.
 */
export type PrintQaAnswerSource = 'printed' | 'handwritten' | 'ai' | 'teacher' | 'none';

/** 문답 한 개 — 문제지·교사용·답지 세 인쇄물이 이것 하나를 쓴다 */
export interface PrintQaItem {
  /** 화면·편집에서 쓰는 안정된 id (저장된다 — 고칠 때 자리를 잃지 않아야 한다) */
  id: string;
  /** 프린트에 인쇄된 번호('3'·'3-1'·'(2)'). 없으면 '' */
  label: string;
  /**
   * 이 물음 **앞에** 놓여 있던 지문·지시문. 없으면 ''.
   *
   * 모델에게 묻지 않고 원문에서 **잘라 온다**(`parse-split.ts`) — 물어서 받으면 그 글이
   * 원문에 있는지 다시 대조해야 하고, 길어서 잘려 오기 일쑤다.
   */
  lead: string;
  /** 물음 (평문, 줄바꿈 유지) */
  question: string;
  /** 인쇄할 답. 없으면 '' */
  answer: string;
  answerSource: PrintQaAnswerSource;
  /**
   * 학생이 손으로 적어 둔 답 원문.
   *
   * ⚠️ 모범답안으로 덮어써도 **남긴다** — 아이가 무엇이라고 썼는지가 사라지면
   *    선생님이 무엇을 고쳐 줘야 하는지 알 수 없다.
   */
  studentAnswer: string;
  /** AI 답의 근거 구절 (자료에 글자 그대로 있는 말). 없으면 '' */
  evidence: string;
  /**
   * 근거를 찾은 곳. `''` 는 이 프린트, 그 밖은 참고자료 이름.
   * **`null` 은 '어디에도 없다'** — 화면·교사용이 '근거 없음' 으로 알린다.
   */
  evidenceSource: string | null;
  /** 물음이 원문에 글자 그대로 있었는가. false 면 화면이 '확인 필요' 로 짚어 준다 */
  verified: boolean;
  /**
   * 이 앞글을 **문제지에 실어도 된다고 사람이 확인했는가**.
   *
   * ⚠️ 기본은 `false` 다. 문항 사이·앞의 글이 '지문' 인지 '아직 안 옮긴 답' 인지는
   *    글자만으로 가릴 수 없다는 것이 열 번의 리뷰로 확인됐다 — 규칙을 조이면 지문이 사라지고
   *    풀면 답이 샌다. 그래서 **기계가 고르지 않는다**: 뽑아 둔 글을 편집 화면에 보여 주고,
   *    선생님이 한 번 눌러야 학생 문제지에 실린다. 교사용·답지는 그와 무관하게 늘 보여 준다.
   */
  leadApproved: boolean;
}

/**
 * 문답 나누기 영수증.
 *
 * ⚠️ `ocr_meta` 에 합치지 않는다 — '다시 읽기' 는 `ocr_meta` 를 통째로 덮어쓰는데
 *    문답은 그 뒤에도 살아 있어야 한다(선생님이 손본 답을 말없이 버리지 않는다).
 */
export interface PrintQaMeta {
  /** 마지막 나누기의 결과 */
  status?: 'done' | 'failed';
  /**
   * 나눌 때 본 `ocr_html` 의 해시.
   *
   * 다시 읽어 본문이 바뀌면 이 값이 어긋난다 — 그때 문답을 **지우지 않고 알린다**
   * (`isQaStale`). 지우면 손으로 고친 답이 말없이 사라진다.
   */
  sourceHash?: string;
  /**
   * 프린트에 **인쇄돼 있던** 작품명·지은이. 인쇄돼 있지 않으면 빈 값이다.
   *
   * 모범답안의 참고자료를 찾는 신호다 — 프린트 이름에 작품이 없을 때 이것이 유일한 단서다.
   */
  work?: { title: string; author: string };
  model?: string | null;
  effort?: string | null;
  /** 사람이 확인해야 하는 것들 */
  warnings?: string[];
  /**
   * 모범답안을 만들 때 함께 읽은 자료 이름들.
   *
   * ⚠️ 그때의 목록을 **굳혀 둔다** — 만든 뒤에도 자료를 빼고 더할 수 있어서, 인쇄가 지금
   *    목록을 보면 "쓰지도 않은 자료 이름 + 옛 자료로 만든 답" 이 한 장에 찍힌다.
   */
  references?: string[];
  /** 마지막으로 모범답안을 만든 시각 */
  answeredAt?: string;
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
  /** 문답으로 나눈 결과. 한 번도 안 나눴으면 빈 배열이다 */
  qa_items: PrintQaItem[];
  /** 문답 나누기 영수증. 한 번도 안 나눴으면 빈 객체다 */
  qa_meta: PrintQaMeta;
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
