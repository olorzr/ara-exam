import { normalizeBoxAttributes } from '@/lib/box-labels';

/**
 * 모델이 낸 본문 HTML 을 저장 형태로 다듬는다 (순수 함수).
 *
 * ⚠️ **정화(`sanitizeProblemHTML`)보다 먼저** 돌아야 한다. 정화기는 허용 목록 밖 값을
 *    되돌릴 수 없게 지우므로(`data-box="(가)"` → 속성째 소멸), 다듬기가 뒤로 가면
 *    상자 말머리가 조용히 사라진다.
 */

/**
 * 인쇄된 배점 표기.
 * `(3.4점)` `[3점]` `（3점）` `【3점】` — 뒤에 태그나 글 끝이 오는 것만 지운다.
 * 그래야 '다음 중 (3점)짜리 문항은?' 같은 본문 속 표기를 건드리지 않는다.
 */
const PRINTED_SCORE_RE = /\s*[([（［【]\s*\d+(?:\.\d+)?\s*점\s*[)\]）］】](?=\s*(?:<|$))/g;

/** 내용이 없는 문단 — 공백만 있거나 `<br>` 하나뿐인 것도 빈 문단이다 */
const BLANK_PARAGRAPH_RE = /<p(\s[^>]*)?>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi;

/**
 * 빈 문단의 모양을 `<p></p>` 하나로 통일한다.
 *
 * 인쇄 CSS 가 `p:empty` 로 한 줄 높이를 주는데, `:empty` 는 **공백 한 칸만 들어 있어도
 * 맞지 않는다**. 모델은 `<p> </p>`·`<p><br></p>` 를 섞어 내므로 여기서 맞춘다.
 * @param html - 본문 HTML
 * @returns 빈 문단이 `<p></p>` 로 통일된 HTML
 */
export function normalizeBlankParagraphs(html: string): string {
  return html.replace(BLANK_PARAGRAPH_RE, '<p></p>');
}

/**
 * 발문에 글자로 딸려 온 배점 표기를 지운다.
 * 배점은 인쇄하지 않으므로(2026-09-08) 본문에 남으면 그것만 남아 어색하다.
 * @param html - 발문 HTML
 * @returns 배점 표기를 뺀 HTML
 */
export function stripPrintedScore(html: string): string {
  return html.replace(PRINTED_SCORE_RE, '');
}

/**
 * 지문 본문 다듬기 — 상자 말머리 정규화 + 빈 문단 통일.
 * @param html - 모델이 낸 지문 HTML
 * @returns 정화에 넘길 HTML
 */
export function normalizeOcrPassageHtml(html: string): string {
  return normalizeBlankParagraphs(normalizeBoxAttributes(html));
}

/**
 * 발문 다듬기 — 지문과 같고 배점 표기만 더 지운다.
 * @param html - 모델이 낸 발문 HTML
 * @returns 정화에 넘길 HTML
 */
export function normalizeOcrStemHtml(html: string): string {
  return stripPrintedScore(normalizeOcrPassageHtml(html));
}
