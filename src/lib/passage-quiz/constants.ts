/** 지문으로 만드는 O,X·단답형의 정책값 */

/**
 * 한 유형(O,X / 단답형)에서 한 번에 받을 수 있는 최대 개수.
 *
 * ⚠️ 스키마 `maxItems`·프롬프트의 상한 문구·파서의 자름이 **전부 이 값 하나**를 본다 —
 *    셋이 갈라지면 모델이 엄격 스키마를 어겨 출력이 통째로 실패한다
 *    (`concept-pick/constants.ts` 의 `CONCEPT_PICK_MAX_COUNT` 와 같은 규약).
 */
export const PASSAGE_QUIZ_MAX_PER_TYPE = 15;

/**
 * 개수를 비워 뒀을 때 프롬프트에 주는 눈대중.
 * 사람이 정하는 값이 아니다 — 지문 길이와 담긴 내용을 보고 AI 가 가감한다.
 */
export const PASSAGE_QUIZ_TYPICAL = 5;

/** O,X 진술 한 문장의 길이 상한 (글자) */
export const PASSAGE_QUIZ_STATEMENT_MAX = 150;

/** 단답형 질문 한 문장의 길이 상한 (글자) */
export const PASSAGE_QUIZ_QUESTION_MAX = 150;

/** 단답형 답의 길이 상한 — 낱말이나 짧은 구여야 채점이 갈리지 않는다 */
export const PASSAGE_QUIZ_ANSWER_MAX = 40;

/** 근거 구절의 길이 상한. 문장 하나면 충분하다 */
export const PASSAGE_QUIZ_EVIDENCE_MAX = 200;

/** 지문 길이 상한 — 넘으면 보내지 않고 먼저 사람에게 알린다 */
export const PASSAGE_QUIZ_TEXT_LIMIT = 40_000;

/** 이미지가 없고 출력도 짧아 기본 워치독으로 충분하다 */
export const PASSAGE_QUIZ_TIMEOUT_MS = 120_000;

/** 인쇄 블록 하나에 담을 지문 줄 수 상한 — 한 문단이 길면 여기서 쪼갠다 */
export const PASSAGE_BLOCK_MAX_LINES = 12;

/**
 * 인쇄 블록 하나에 담을 글자 수 상한.
 *
 * 줄 수만으로는 모자란다 — 비문학 지문은 줄바꿈 없이 몇천 자가 **한 줄**로 들어온다.
 * 그러면 블록이 하나뿐이라 `A4Document` 가 한 쪽에 욱여넣으려고 통째로 축소한다(글씨가 작아진다).
 */
export const PASSAGE_BLOCK_MAX_CHARS = 900;

/** 아카이브 지문 고르기 목록의 최대 줄 수 */
export const PASSAGE_PICK_LIMIT = 30;

/** 정답표 한 줄에 담을 문항 수 — 기출 정답표(`ProblemAnswerKeyView`)와 같은 규약 */
export const QUIZ_KEY_ITEMS_PER_ROW = 5;
