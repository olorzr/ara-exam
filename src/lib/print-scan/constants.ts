/**
 * 학교 프린트 읽기의 정책값.
 *
 * 기출 OCR(`problem-ocr/constants.ts`)과 **일부러 다른 값**이 하나 있다 — 겹침이다.
 * 그 까닭은 아래 주석에 적어 두었다.
 */

/** 한 번에 보낼 쪽 수. 기출과 같다 — 지연을 지배하는 건 출력 토큰이라 3쪽이 한계다 */
export const PRINT_PAGES_PER_BATCH = 3;

/**
 * 앞 묶음과 겹칠 쪽 수 — **0 이다. 1 로 올리지 말 것.**
 *
 * 기출은 쪽 경계를 넘는 '지문' 을 온전히 보려고 한 쪽을 겹쳐 읽고, 겹쳐 읽은 결과를
 * `merge.ts` 가 지문 단위로 합친다(더 긴 쪽이 이긴다). 프린트 읽기의 결과는 **구조 없는
 * 평문 HTML** 이라 그렇게 합칠 수가 없다 — 겹치면 같은 글이 시험지에 **두 번** 들어간다.
 * 대신 프롬프트가 "이 쪽의 마지막 문단은 이 쪽에서 끝나는 곳까지만" 이라고 못박는다.
 */
export const PRINT_BATCH_OVERLAP = 0;

/** 한 묶음(= 한 번의 읽기)이 낼 수 있는 경고 수 */
export const PRINT_OCR_MAX_WARNINGS = 20;

/** 묶음 전체를 합친 뒤의 경고 상한 — 안 걸면 ocr_meta 가 끝없이 커진다 */
export const PRINT_MAX_MERGED_WARNINGS = 40;
