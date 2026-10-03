/** 작품 전문의 정책값 */

/**
 * 전문 한 편의 길이 상한 (글자).
 *
 * 장편 소설은 이 상한을 넘는데, 그런 글은 **참고자료로 통째로 실을 수도 없다**
 * (`QUIZ_REFERENCE_TEXT_MAX` 가 앞에서 자른다). 시·단편·수필을 담는 크기다.
 */
export const REFERENCE_TEXT_BODY_MAX = 200_000;

/** 목록에 한 번에 읽는 최대 줄 수 — 작품 수백 편 규모라 페이지를 나누지 않는다 */
export const REFERENCE_TEXT_LIST_LIMIT = 200;

/** 참고자료 고르기·자동 매칭 목록의 최대 줄 수 */
export const REFERENCE_TEXT_PICK_LIMIT = 30;

/** 목록 검색을 서버에 물어보기까지 기다리는 시간 (ms) — 글자마다 조회하면 왕복만 는다 */
export const REFERENCE_SEARCH_DEBOUNCE_MS = 250;

/**
 * 전문 하나에 붙일 수 있는 교과서 단원 수.
 * ⚠️ DB 검사 함수(`exam.reference_units_valid`, sql/60)의 상한과 **같아야 한다** —
 *    한쪽만 늘리면 화면은 받는데 저장이 CHECK 에 막힌다.
 */
export const REFERENCE_UNITS_MAX = 8;

/** 판본 메모 길이 상한 (글자) — DB CHECK `reference_texts_note_len` 과 같다 */
export const REFERENCE_NOTE_MAX = 200;

/**
 * 패싯(트리) 스캔 — 한 번에 읽는 줄 수와 전체 상한.
 * PostgREST 기본 상한(1,000)에서 말없이 잘리면 트리에서 작품이 조용히 사라진다
 * (문제 은행 `facets.ts` 와 같은 값·같은 이유).
 */
export const REFERENCE_FACET_CHUNK = 1000;
export const REFERENCE_FACET_MAX_ROWS = 20_000;
