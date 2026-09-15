/** AI 추천 빈칸의 정책값 */

/**
 * 프롬프트에 주는 눈대중 — 시험지 한 장에 10개 안팎이면 적당하다는 운영 기준.
 * 사람이 정하는 값이 아니다. AI 가 본문 길이·외울 개념의 양을 보고 가감한다.
 */
export const CONCEPT_PICK_TYPICAL_COUNT = 10;

/**
 * 한 번에 받을 수 있는 최대 개수.
 * 스키마 `maxItems`·프롬프트의 상한 문구·파서의 자름이 **전부 이 값 하나**를 본다 —
 * 셋이 갈라지면 모델이 스키마를 어겨 출력이 통째로 실패한다.
 */
export const CONCEPT_PICK_MAX_COUNT = 30;

/** 용어 하나의 길이 상한 (글자) */
export const CONCEPT_PICK_TEXT_MAX = 40;

/**
 * 용어의 최소 길이.
 *
 * 한 글자를 허용하면 `findMarkTarget` 의 `indexOf` 가 **더 긴 낱말 안쪽**을 잡는다
 * ('시' 가 '자유시' 안에서 걸린다). 두 글자여도 완전히 막히지는 않지만 크게 줄어든다.
 */
export const CONCEPT_PICK_TEXT_MIN = 2;

/** 근거 한 줄의 길이 상한 */
export const CONCEPT_PICK_REASON_MAX = 120;

/**
 * 자리 힌트(`context`)의 길이 상한.
 *
 * 같은 낱말이 작품 원문과 풀이 표에 다 있을 때 **어느 쪽에 빈칸을 뚫을지** 정하는 재료다.
 * 길게 받을 이유가 없다 — 표 한 칸이나 문장 하나면 자리가 정해진다.
 */
export const CONCEPT_PICK_CONTEXT_MAX = 60;

/** 본문 길이 상한 — 넘으면 보내지 않고 사람에게 알린다 */
export const CONCEPT_PICK_TEXT_LIMIT = 40_000;

/** 이미지가 없고 출력도 짧아 기본 워치독으로 충분하다 */
export const CONCEPT_PICK_TIMEOUT_MS = 120_000;
