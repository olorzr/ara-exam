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
