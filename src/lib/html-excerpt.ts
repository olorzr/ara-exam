/**
 * 목록 카드·캔버스에 보여 줄 **한 줄 미리보기** (순수 함수).
 *
 * 태그를 걷고 → 엔티티를 풀고 → 공백을 한 칸으로 접는다. 엔티티를 안 풀면 발문의
 * `&lt;보기&gt;` 가 카드에 글자 그대로 찍힌다(2026-09-30 제보 "꺾쇠가 안 보인다").
 *
 * `concept-pick/plain-text.ts` 의 `htmlToPlainText` 를 쓰지 않는 까닭: 그쪽은 모델에게
 * 구조를 보여 주려고 표를 `| 칸 |`, 제목을 `#` 으로 남긴다 — 미리보기에는 그 기호가 군더더기다.
 */

import { decodeHtmlEntities } from './html-entities';

/**
 * HTML 을 한 줄 평문으로.
 * @param html - 저장된 본문 HTML
 * @returns 태그를 걷고 엔티티를 푼 한 줄 글
 */
export function htmlToExcerptText(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/**
 * 길이 상한을 넘으면 `…` 으로 자른 미리보기.
 * @param html - 저장된 본문 HTML
 * @param maxLength - 보여 줄 최대 글자 수
 * @returns 미리보기 글
 */
export function excerptHtml(html: string, maxLength: number): string {
  const text = htmlToExcerptText(html);
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}
