import { innerPaperOf } from './inner-papers';
import { pageCountFreshness } from './layout';
import { EDITION_LABELS, type BookEdition } from './settings';
import { padPageCount, spineWidthMm } from './spine';
import type { Book, BookChapter } from './types';

/**
 * 책등을 그릴 쪽 수 — 어디서 왔는가와 함께 (순수 함수).
 *
 * 표지 화면 · 주문 요약 · 목록이 **이 파일의 함수**로 쪽 수를 정한다. 각자 정하면 같은 항목이 화면마다 다른 책등을 말한다.
 * - 책: 내지 화면이 재서 저장한 쪽 수(`books.page_counts`). 장 구성이 그 뒤에 바뀌었으면 쓰지 않는다 — 옛 쪽 수로 그린
 *   책등은 조용히 틀린다(`pageCountFreshness`).
 * - 표지만: 직접 넣은 쪽 수(`settings.manualPages`)를 4의 배수로 올린 값 — 내지 화면이 재는 값(빈 쪽을 붙인 총 쪽 수)과
 *   같은 규약이라야 같은 쪽 수를 넣었을 때 책과 표지만 항목의 책등이 같다.
 */

/** 책등을 그릴 쪽 수 */
export interface SpinePages {
  /** 4의 배수로 채운 총 쪽 수 */
  pages: number;
  /** 잰 값(책) / 직접 넣은 값(표지만) */
  source: 'measured' | 'manual';
}

/**
 * 표지만 항목의 판 하나 — 직접 넣은 값을 4의 배수로 올린다.
 * @param book - 표지만 항목
 * @param edition - 판
 * @returns 쪽 수(안 넣었으면 null)
 */
function manualSpinePages(book: Book, edition: BookEdition): SpinePages | null {
  const entered = book.settings.manualPages[edition];
  return entered ? { pages: padPageCount(entered), source: 'manual' } : null;
}

/**
 * 지금 책등을 그려도 되는 쪽 수.
 * @param book - 항목
 * @param chapters - 장(책일 때 구성 지문을 맞춰 보려고 쓴다)
 * @param edition - 판
 * @returns 쪽 수(못 그리면 null — 책은 아직 안 쟀거나 구성이 바뀌었고, 표지만은 안 넣었다)
 */
export function resolveSpinePages(book: Book, chapters: readonly BookChapter[], edition: BookEdition): SpinePages | null {
  if (book.kind === 'cover') return manualSpinePages(book, edition);
  const stored = book.pageCounts[edition];
  if (!stored || pageCountFreshness(book, chapters, edition) !== 'fresh') return null;
  return { pages: stored.pages, source: 'measured' };
}

/**
 * 목록 한 줄의 쪽 수 — 목록은 장을 읽지 않아 구성 지문을 맞춰 볼 수 없으므로 저장된 값을 그대로 보여 준다.
 * ⚠️ 책등을 **그리는** 곳에서는 쓰지 말 것 — `resolveSpinePages` 를 쓴다.
 * @param book - 항목
 * @param edition - 판
 * @returns 쪽 수(없으면 null)
 */
export function storedSpinePages(book: Book, edition: BookEdition): SpinePages | null {
  if (book.kind === 'cover') return manualSpinePages(book, edition);
  const stored = book.pageCounts[edition];
  return stored ? { pages: stored.pages, source: 'measured' } : null;
}

/**
 * 그 항목의 내지 용지로 잰 책등 폭.
 * @param book - 항목(내지 용지를 읽는다)
 * @param pages - 4의 배수로 채운 총 쪽 수
 * @returns 책등 폭(mm)
 */
export function spineMmOf(book: Book, pages: number): number {
  return spineWidthMm(pages, innerPaperOf(book.settings.innerPaper).thicknessMm);
}

/**
 * 책등 제목 — 적은 책등 글자(없으면 책 제목)에 판 이름을 붙인다(학생용은 붙이지 않는다).
 * 표지 화면(책등에 찍는다)과 표지 설정(글꼴 고르기 칸의 미리보기)이 함께 쓴다.
 * @param book - 책
 * @param edition - 판
 * @returns 책등 위쪽 글
 */
export function spineTitleOf(book: Book, edition: BookEdition): string {
  const base = book.settings.spineText || book.title;
  return edition === 'student' ? base : `${base} · ${EDITION_LABELS[edition]}`;
}
