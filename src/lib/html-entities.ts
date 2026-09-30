/**
 * HTML 엔티티를 글자로 되돌린다 (순수 함수).
 *
 * 편집기·적재 스펙이 본문에 넣는 `&lt;보기&gt;` 는 **HTML 로 그리면** `<보기>` 로 보이지만,
 * 태그만 걷어 React 텍스트로 찍으면 `&lt;보기&gt;` 가 글자 그대로 나온다. 평문을 만드는
 * 자리(목록 미리보기·모델에게 보낼 평문)는 태그를 걷은 **뒤에** 이 함수를 불러야 한다.
 *
 * ⚠️ **태그를 먼저 걷고 나서 푼다.** 먼저 풀면 `&lt;b&gt;` 가 `<b>` 가 되어 태그 걷기에
 *    잡혀 사라진다 — 인용된 꺾쇠 글자가 통째로 없어진다.
 */

/** 이름 있는 엔티티 — TipTap·적재 스펙이 내는 것만 */
export const HTML_ENTITIES: readonly (readonly [RegExp, string])[] = [
  [/&nbsp;/g, ' '],
  [/&lt;/g, '<'],
  [/&gt;/g, '>'],
  [/&quot;/g, '"'],
  [/&#39;/g, "'"],
  // ⚠️ &amp; 는 **마지막**이다. 먼저 풀면 `&amp;lt;` 가 `<` 로 두 번 풀린다
  [/&amp;/g, '&'],
];

/**
 * 태그를 걷어낸 글에서 엔티티를 글자로 되돌린다.
 * @param text - 태그를 이미 걷어낸 글
 * @returns 엔티티를 푼 글
 */
export function decodeHtmlEntities(text: string): string {
  let out = text;
  for (const [pattern, value] of HTML_ENTITIES) {
    out = out.replace(pattern, value);
  }
  return out;
}
