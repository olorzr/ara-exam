/**
 * 편집기 HTML 을 모델에게 보낼 **평문**으로 (순수 함수).
 *
 * 태그째 보내지 않는 이유: ① 토큰이 두 배로 든다, ② 모델이 태그 조각(`strong`, `td`)을
 * 용어로 고를 여지를 준다. 우리가 필요한 것은 **화면에 보이는 글자**뿐이다.
 *
 * ⚠️ 여기서 만든 평문이 '본문에 그 말이 있는가' 판정의 기준이 된다
 *    (`parse.ts` 의 `plain.includes(text)`). 그래서 글자를 **지우지 않는 것**이 중요하다 —
 *    엔티티를 그대로 두면 `&amp;` 를 포함한 용어가 영영 '본문에 없음' 이 된다.
 */

/** 줄바꿈으로 볼 블록 태그 */
const BLOCK_END = /<\/(p|div|h[1-6]|li|tr|blockquote|table|thead|tbody)>/gi;

/** 이름 있는 엔티티 — TipTap 이 내는 것만 */
const ENTITIES: [RegExp, string][] = [
  [/&nbsp;/g, ' '],
  [/&lt;/g, '<'],
  [/&gt;/g, '>'],
  [/&quot;/g, '"'],
  [/&#39;/g, "'"],
  // ⚠️ &amp; 는 **마지막**이다. 먼저 풀면 `&amp;lt;` 가 `<` 로 두 번 풀린다
  [/&amp;/g, '&'],
];

/**
 * HTML 에서 보이는 글자만 뽑는다.
 * @param html - 편집기 HTML
 * @returns 줄 단위 평문
 */
export function htmlToPlainText(html: string): string {
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(BLOCK_END, '\n')
    // 표의 칸 구분은 탭으로 — 붙여 두면 두 칸의 글자가 한 낱말처럼 보인다
    .replace(/<\/(td|th)>/gi, '\t')
    .replace(/<[^>]*>/g, '');

  for (const [pattern, value] of ENTITIES) {
    text = text.replace(pattern, value);
  }

  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, (m) => (m.includes('\t') ? '\t' : ' ')).trim())
    .filter((line, i, lines) => line !== '' || lines[i - 1] !== '')
    .join('\n')
    .trim();
}
