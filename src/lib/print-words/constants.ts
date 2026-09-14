/** 프린트 단어 등록의 정책값 */

/** 한 프린트에서 받을 수 있는 최대 단어 수 — 어휘 정리가 아무리 길어도 이 정도면 넉넉하다 */
export const PRINT_WORDS_MAX_COUNT = 100;

/** 표제어 길이 상한 (글자). `words.word` 에 CHECK 가 없어 여기서 막는다 */
export const PRINT_WORD_MAX = 40;

/** 뜻 길이 상한 (글자) */
export const PRINT_MEANING_MAX = 300;

/**
 * 본문 길이 상한 — 넘으면 보내지 않고 사람에게 알린다.
 * `concept-pick` 과 같은 값이다(같은 편집기 본문을 평문으로 보낸다).
 */
export const PRINT_WORDS_TEXT_LIMIT = 40_000;

/** 이미지가 없고 출력도 짧아 기본 워치독으로 충분하다 */
export const PRINT_WORDS_TIMEOUT_MS = 120_000;

/** 영수증에 남길 경고 수 상한 — 안 걸면 words_meta 가 끝없이 커진다 */
export const PRINT_WORDS_MAX_WARNINGS = 20;

/** 경고에 이름을 그대로 적어 줄 단어 수 (나머지는 '외 N개') */
export const PRINT_WORDS_SAMPLE = 10;
