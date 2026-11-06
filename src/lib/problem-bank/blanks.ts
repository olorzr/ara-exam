import { createHost } from '@/lib/print/table-dom';

/**
 * 밑줄·네모로 만든 빈칸을 한 덩어리로 그리게 표시한다.
 *
 * 시험지의 빈칸은 전각 공백으로 적혀 있다(`<u>　　　</u>`, `<u>　㉠　</u>`, `<code>　ⓐ　</code>`). 브라우저는 줄 끝의
 * 전각 공백을 다음 줄로 넘기지 않고 **단 밖에 걸쳐 둔다.** 글자는 안 보여도 밑줄·테두리는 그대로 그려져 옆 단으로
 * 뻗었다(운영 최대 87px, 2026-11-06 전수 측정). `white-space` 는 그릇에 걸어야 하는데 밑줄 글 전체에 걸면 멀쩡한
 * 글의 줄바꿈이 바뀌므로, 빈칸만 골라 표시한다. 표시가 붙으면 빈칸이 통째로 다음 줄로 넘어가 두 줄로 갈리지도 않는다.
 *
 * ⚠️ **데이터에 저장하지 않고 그릴 때 붙인다**(각주·옛한글 표시와 같은 규약). 정화한 **뒤에** 부르고 다시 정화하지 않는다.
 */

/** 표시 클래스 — problem-paper.css 의 `.pb-blank` 와 짝이다 */
export const BLANK_CLASS = 'pb-blank';

const IDEOGRAPHIC_SPACE = '　';

/** 전각 공백이 든 밑줄·네모가 있을 때만 DOM 을 만든다 */
const MAY_HOLD_BLANK = /<(?:u|code)\b[^>]*>[^<]*　/;

/** 빈칸 안의 표시 글자 한도 — '㉠'·'ⓐ'·'“ ㉠ ”' 처럼 자리를 가리키는 글자뿐이다 */
const MAX_MARK_CHARS = 3;

/**
 * 이 글이 빈칸인가 — 전각 공백이 있고, 공백을 뺀 글자가 표시 글자뿐이다.
 * @param text - 요소의 글
 * @returns 빈칸이면 true
 */
export function isBlankText(text: string): boolean {
  return text.includes(IDEOGRAPHIC_SPACE) && text.replace(/\s/g, '').length <= MAX_MARK_CHARS;
}

/**
 * 정화한 발문·지문 HTML 에서 빈칸에 표시를 붙인다.
 * @param html - **정화가 끝난** HTML
 * @returns 빈칸에 `class="pb-blank"` 가 붙은 HTML. 빈칸이 없거나 브라우저가 아니면 들어온 글자 그대로
 */
export function markBlanks(html: string): string {
  if (!MAY_HOLD_BLANK.test(html)) return html;
  const host = createHost(html);
  if (!host) return html;
  const blanks = Array.from(host.querySelectorAll('u, code')).filter((el) => isBlankText(el.textContent ?? ''));
  blanks.forEach((el) => el.classList.add(BLANK_CLASS));
  return blanks.length > 0 ? host.innerHTML : html;
}
