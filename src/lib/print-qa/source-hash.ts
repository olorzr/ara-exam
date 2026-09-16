/**
 * 읽어 둔 본문의 **지문(指紋)** (순수 함수).
 *
 * 나눌 때 본 `ocr_html` 이 그 뒤에 바뀌었는지(= '다시 읽기' 가 돌았는지)만 알면 되므로
 * 짧고 값싼 FNV-1a 로 충분하다 — 보안용이 아니다.
 *
 * ⚠️ 본문 전체를 `qa_meta` 에 넣어 견주는 대신 해시를 두는 까닭: 프린트 한 장이 수만 자라
 *    행이 두 배가 되고, 그 행은 감사 로그에 `old_data`/`new_data` 로 **두 번 더** 실린다.
 */

/** FNV-1a 오프셋 베이시스 */
const OFFSET = 2166136261;

/** FNV-1a 소수 */
const PRIME = 16777619;

/**
 * 본문 해시.
 * @param html - 읽어 둔 본문 HTML
 * @returns 8자리 16진수
 */
export function printQaSourceHash(html: string): string {
  let h = OFFSET >>> 0;
  for (let i = 0; i < html.length; i += 1) {
    h ^= html.charCodeAt(i);
    h = Math.imul(h, PRIME);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
