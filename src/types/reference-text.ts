/**
 * 작품 전문 (sql/30 `exam.reference_texts`).
 *
 * 개념 관리에 올려 두는 **작품 원문 전체**다. 문제 만들기(O,X·단답형)가 참고자료로
 * 함께 읽어, 잘린 지문만으로는 낼 수 없는 문항의 근거를 여기서 가져온다.
 *
 * ⚠️ `body` 는 **평문**이다(개념지의 `editor_html` 과 다르다). 서식이 필요 없고,
 *    평문이면 화면이 텍스트 노드로만 그려 정화를 한 겹 더 두는 것보다 확실하다.
 */
export interface ReferenceText {
  id: string;
  /** 작품명. 자동 매칭이 이 이름으로 지문을 찾는다 */
  title: string;
  author: string;
  /** 작품 전문 (평문) */
  body: string;
  /**
   * 본문 글자 수.
   *
   * ⚠️ **DB 트리거가 채운다**(`ab_reference_texts_char_count`) — 앱이 보내는 값은 무시된다.
   *    목록이 무거운 `body` 를 읽지 않고도 길이를 보여 주려고 둔 값이다.
   */
  char_count: number;
  /**
   * 실린 교과서 단원들 (최대 `REFERENCE_UNITS_MAX`).
   * 한 작품이 여러 교과서에 실리므로 **여럿**이다(sql/60).
   */
  units: ReferenceUnit[];
  /** 문법 분류 — `problems.grammar_paths` 와 같은 모양('단어 > 품사 > 명사', 최대 5) */
  grammar_paths: string[];
  /**
   * 판본 메모 — 같은 작품을 교과서마다 다른 본문으로 따로 올릴 때 가르는 한 줄
   * ('교학사 수록본·현대어 표기'). 비어 있어도 된다.
   */
  note: string;
  user_id: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 목록용 경량 타입 — 무거운 `body` 는 뺀다.
 *
 * ⚠️ `reference-texts/queries.ts` 의 `REFERENCE_TEXT_LIST_COLUMNS` 와 **1:1로 맞춰 둔다**.
 *    타입엔 있는데 조회에 없으면 런타임에 조용한 undefined 가 된다
 *    (`ConceptSheetListItem` ↔ `LIST_COLUMNS` 와 같은 규약).
 */
export type ReferenceTextListItem = Omit<ReferenceText, 'body'>;

/**
 * 전문이 실린 교과서 단원 하나 (sql/60 `units` 의 원소).
 *
 * 카테고리 관리(중등·고등)의 **이름 스냅샷**이다(id 아님) — 문항의 `unit_path` 와 같은 규약.
 * 문항은 교과서·학년·학기를 출처 행에 두지만 전문에는 출처가 없어 원소가 함께 든다.
 * ⚠️ 학교 축은 없다(원장님 결정) — 학교·학년도를 넣지 않는다.
 */
export interface ReferenceUnit {
  /** '중2' */
  grade: string;
  /** 교과서 (= 카테고리의 출판사 이름) '천재(노미숙)' */
  textbook: string;
  /** '1학기' | '2학기' | '' */
  semester: string;
  /** [대단원] 또는 [대단원, 소단원] */
  unit_path: string[];
}
