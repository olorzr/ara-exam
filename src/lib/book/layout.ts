import { bookLayoutKey, type BookEdition } from './settings';
import { chapterTitleOf, type Book, type BookChapter } from './types';

/**
 * 지금 책 구성의 내지 지문 — 내지 화면(쪽 수를 저장할 때)과 표지 화면(저장된 쪽 수를 믿어도 되는지 볼 때)이
 * **같은 함수**로 만든다. 두 곳에서 입력을 따로 모으면 한쪽만 고쳐져 늘 '다시 재세요' 가 뜨거나, 반대로 옛 쪽 수를
 * 믿고 책등이 틀린다.
 * @param book - 책
 * @param chapters - 장(차례대로)
 * @param edition - 판
 * @returns 지문
 */
export function bookLayoutKeyFor(book: Book, chapters: readonly BookChapter[], edition: BookEdition): string {
  return bookLayoutKey({
    edition,
    title: book.title,
    settings: book.settings,
    // 문제지 판까지 — 문제지를 고치면 그 책은 다시 재야 한다(sql/103 은 page_counts 도 비운다. 열어 둔 내지 탭이
    // 옛 쪽 수를 되살려도 지문이 달라 표지 화면이 막는다)
    chapters: chapters.map((c) => ({ paperId: c.paperId, title: chapterTitleOf(c), revision: c.paper?.updated_at })),
  });
}

/** 판 하나의 쪽 수 기록이 지금 구성에 맞는가 */
export type PageCountFreshness = 'fresh' | 'stale' | 'missing';

/**
 * 저장된 쪽 수가 지금 구성의 것인가.
 * @param book - 책
 * @param chapters - 장
 * @param edition - 판
 * @returns 맞음 / 구성이 바뀜 / 잰 적 없음
 */
export function pageCountFreshness(
  book: Book, chapters: readonly BookChapter[], edition: BookEdition,
): PageCountFreshness {
  const stored = book.pageCounts[edition];
  if (!stored) return 'missing';
  return stored.key === bookLayoutKeyFor(book, chapters, edition) ? 'fresh' : 'stale';
}
