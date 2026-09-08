/**
 * 인쇄 직전 **가장자리 빈 문단** 정리 (순수 함수).
 *
 * 원문이 비워 둔 줄은 빈 문단으로 담고 인쇄에서 한 줄 높이를 준다. 문제는 글 **끝**에
 * 붙은 빈 문단이다:
 *  - TipTap(StarterKit 3.x)의 `trailingNode` 가 표·상자로 끝나는 글 뒤에 빈 문단을
 *    자동으로 붙인다 — 사람이 만든 빈 줄이 아니다.
 *  - 지문 조각은 상자 테두리 안에 그려지므로 마지막 조각이 빈 문단이면 상자 아래가 뜬다.
 *  - 발문 끝의 빈 문단은 선지 앞에 빈 줄을 만든다.
 *
 * 가운데 빈 문단은 **그대로 둔다** — 그건 원문의 빈 줄이다.
 */

/** 내용 없는 문단인가 (`<p></p>`·`<p> </p>`·`<p><br></p>`) */
const EMPTY_PARAGRAPH_RE = /^<p(?:\s[^>]*)?>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>$/i;

/**
 * 이 블록이 빈 문단 하나뿐인가.
 * @param html - 블록 HTML
 * @returns 빈 문단이면 true
 */
export function isEmptyParagraph(html: string): boolean {
  return EMPTY_PARAGRAPH_RE.test(html.trim());
}

/**
 * 조각 목록의 앞뒤에 붙은 빈 문단을 걷어낸다.
 * @param parts - 지문 조각 HTML 목록
 * @returns 가운데 빈 줄은 남기고 가장자리만 없앤 목록
 */
export function trimEdgeEmptyParagraphs(parts: string[]): string[] {
  let start = 0;
  let end = parts.length;
  while (start < end && isEmptyParagraph(parts[start])) start += 1;
  while (end > start && isEmptyParagraph(parts[end - 1])) end -= 1;
  return parts.slice(start, end);
}

/** 글 끝의 빈 문단들 */
const TRAILING_EMPTY_RE = /(?:<p(?:\s[^>]*)?>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>\s*)+$/i;

/**
 * 글 끝에 붙은 빈 문단을 걷어낸다 (발문처럼 한 덩어리인 HTML 용).
 * @param html - 발문·설명 HTML
 * @returns 끝의 빈 문단을 없앤 HTML
 */
export function stripTrailingEmptyParagraphs(html: string): string {
  return html.replace(TRAILING_EMPTY_RE, '');
}
