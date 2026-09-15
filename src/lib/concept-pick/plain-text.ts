/**
 * 편집기 HTML 을 모델에게 보낼 **평문**으로 (순수 함수).
 *
 * 태그째 보내지 않는 이유: ① 토큰이 두 배로 든다, ② 모델이 태그 조각(`strong`, `td`)을
 * 용어로 고를 여지를 준다. 우리가 필요한 것은 **화면에 보이는 글자**뿐이다.
 *
 * 다만 **구조는 남긴다** — 표는 `| 칸 | 칸 |`, 제목은 `#`, 목록은 `-`. 개념지는 작품 원문과
 * 그것을 설명한 표가 섞여 있는데, 전부 같은 줄로 납작해지면 모델이 둘을 가릴 수가 없고
 * 표의 행이 통째로 흩어져 '시어 ↔ 뜻' 짝이 깨진다.
 *
 * ⚠️ **칸을 먼저 처리한다.** TipTap 은 칸을 언제나 `<td><p>…</p></td>` 로 내보내므로,
 *    `</p>` 를 먼저 줄바꿈으로 바꾸면 칸 구분 규칙이 **닿기도 전에 무력화된다**
 *    (예전 `</td>`→탭 규칙이 정확히 그래서 죽은 코드였다).
 * ⚠️ 여기서 만든 평문이 '본문에 그 말이 있는가' 판정의 기준이 된다
 *    (`parse.ts` 의 `plain.includes(text)`). 그래서 글자를 **지우지 않는 것**이 중요하다 —
 *    엔티티를 그대로 두면 `&amp;` 를 포함한 용어가 영영 '본문에 없음' 이 된다.
 *    같은 이유로 `|` 는 **앞뒤를 공백으로 띄운다**: 한 어절 용어가 기호와 붙으면 못 찾는다.
 */

/** 줄바꿈으로 볼 블록 태그 (표 관련은 앞 단계에서 이미 처리한다) */
const BLOCK_END = /<\/(p|div|h[1-6]|li|blockquote|table|thead|tbody)>/gi;

/** 표의 칸 — 여는 태그부터 닫는 태그까지 통째로 잡는다 */
const TABLE_CELL = /<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi;

/** 제목 태그를 몇 단으로 볼 것인가 (TipTap 은 h3·h4 만 낸다) */
const HEADING_OPEN = /<h([1-6])\b[^>]*>/gi;

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
 * 표 한 칸의 속을 한 줄로. 칸 안의 문단·줄바꿈은 **공백**이다 — 줄을 나누면 칸이 흩어진다.
 * @param inner - 칸 안쪽 HTML
 * @returns 태그를 걷어낸 한 줄
 */
function cellText(inner: string): string {
  return inner
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * HTML 에서 보이는 글자만 뽑는다. 표·제목·목록의 구조는 기호로 남긴다.
 * @param html - 편집기 HTML
 * @returns 줄 단위 평문
 */
export function htmlToPlainText(html: string): string {
  let text = html
    // ① 칸 먼저 — 안쪽 `</p>` 가 줄바꿈이 되기 전에 한 줄로 접는다
    .replace(TABLE_CELL, (_m, _tag, inner: string) => `| ${cellText(inner)} `)
    // ② 행 끝에 닫는 기호를 두고 줄을 바꾼다
    .replace(/<\/tr>/gi, '|\n')
    .replace(HEADING_OPEN, (_m, level: string) => (Number(level) <= 3 ? '# ' : '## '))
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(BLOCK_END, '\n')
    .replace(/<[^>]*>/g, '');

  for (const [pattern, value] of ENTITIES) {
    text = text.replace(pattern, value);
  }

  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line, i, lines) => line !== '' || lines[i - 1] !== '')
    .join('\n')
    .trim();
}
