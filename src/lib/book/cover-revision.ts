import { BOOK_EDITIONS, type BookPageCounts } from './settings';

/**
 * 표지 화면이 믿고 있는 값의 서명 — 저장된 쪽 수와 장마다 담긴 문제지의 판(`updated_at`).
 *
 * 표지 화면을 열어 둔 사이 담긴 문제지가 다른 탭에서 고쳐지면(sql/103) DB 의 쪽 수는 비워지는데 이 화면은 읽어 둔
 * 쪽 수와 판으로 '지금 구성에서 잰 값' 이라 판단해 옛 책등으로 인쇄한다(코덱스 5R). 다시 읽은 값의 서명과 견준다.
 * @param pageCounts - 저장된 쪽 수(정규화한 것). 내지 화면은 쪽 수를 스스로 저장하므로 null(서명에서 뺀다)
 * @param chapters - 장 차례대로 — 문제지 id 와 판
 * @returns 서명 글자
 */
export function bookCoverSignature(
  pageCounts: BookPageCounts | null, chapters: readonly { paperId: string; revision: string }[],
): string {
  return JSON.stringify([
    pageCounts ? BOOK_EDITIONS.map((e) => (pageCounts[e] ? [e, pageCounts[e].pages, pageCounts[e].key] : [e])) : null,
    chapters.map((c) => [c.paperId, c.revision]),
  ]);
}
