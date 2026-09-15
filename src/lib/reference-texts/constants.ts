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
