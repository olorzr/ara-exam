import { normalizeBoxAttributes } from '@/lib/box-labels';
import { finalizeYetHangul } from '@/lib/yet-hangul';

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
  // ⚠️ 옛한글 대체 표기(`⟦ㅎㆍㄴ⟧` → `ᄒᆞᆫ`)를 **맨 먼저** 바꾼다. 뒤로 미루면 중복 판정
  //    키(merge-keys 의 textOf)와 검수 화면이 괄호 표기를 보게 되어, 겹쳐 읽은 같은 지문이
  //    표기 차이로 둘로 갈라진다
  // ⚠️ 저장 형태로 굳히는 것(`finalizeYetHangul`)은 **정화 뒤**다 — 정화가 HTML 실체 참조를
  //    풀기 때문이다(코덱스 리뷰 4R). 여기서 미리 바꿔 두는 까닭은 상자 말머리 다듬기가
  //    괄호 표기에 걸리지 않게 하려는 것뿐이라, 두 번 돌아도 같은 결과다(멱등)
  return normalizeBlankParagraphs(normalizeBoxAttributes(finalizeYetHangul(html)));
}

/**
 * 말머리(`data-box`)가 없는 상자의 여는 태그 — 속성 순서와 무관하게 잡는다.
 * 태그 이름을 잡아 두는 것은 철자(`<BLOCKQUOTE>`)를 그대로 돌려주기 위해서다 — 여기서 소문자로
 * 바꿔 쓰면 이 함수가 상자 말머리 말고 다른 것도 고친 셈이 된다(정화기가 나중에 어차피 맞춘다).
 */
const BARE_BLOCKQUOTE_RE = /<(blockquote)(?![^>]*\sdata-box\s*=)(\s[^>]*)?>/gi;

/**
 * 발문 안 **말머리 없는 상자**를 〈보기〉로 삼는다.
 *
 * 시험지는 발문 아래 상자에 '〈보기〉' 를 안 찍기도 한다(문법 문항의 예문·대화 상자). 모델은
 * 그 상자를 `<blockquote>` 로만 내는데, 인쇄 CSS 는 `blockquote[data-box]` 만 상자로 그리므로
 * **테두리도 말머리도 없이 들여쓰기만 된 글**로 찍혔다(2025 동마중 22·25·28~30번, 2026-09-20).
 * 발문 안에서 상자로 묶은 것은 곧 〈보기〉다 — 지문은 여기 해당하지 않는다(인용 글일 수 있다).
 *
 * ⚠️ `normalizeBoxAttributes` **뒤에** 돌아야 한다. 허용 목록 밖 말머리('활동지')는 그 함수가
 *    속성째 지워 맨 상자가 되고, 여기서 〈보기〉로 받는다 — 순서를 바꾸면 그 상자만 빠진다.
 * @param html - 발문 HTML (말머리 다듬기가 끝난 것)
 * @returns 모든 상자에 말머리가 붙은 HTML
 */
export function defaultStemBoxes(html: string): string {
  // 빠른 탈출도 정규식과 같이 대소문자를 안 가린다 — `<BLOCKQUOTE>` 도 유효한 태그다(코덱스 3R)
  if (!/<blockquote/i.test(html)) return html;
  return html.replace(BARE_BLOCKQUOTE_RE, (_m, tag: string, attrs: string | undefined) =>
    `<${tag} data-box="보기"${attrs ?? ''}>`);
}

/**
 * 발문 다듬기 — 지문과 같고, 배점 표기를 지우고, 말머리 없는 상자를 〈보기〉로 삼는다.
 * @param html - 모델이 낸 발문 HTML
 * @returns 정화에 넘길 HTML
 */
export function normalizeOcrStemHtml(html: string): string {
  return defaultStemBoxes(stripPrintedScore(normalizeOcrPassageHtml(html)));
}
