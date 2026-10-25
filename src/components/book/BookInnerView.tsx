'use client';

import { useMemo } from 'react';
import { A4Document, CompactPageHeader } from '@/components/print';
import type { LayoutHandler } from '@/hooks/useA4Pagination';
import { EDITION_SUFFIX, type Book, type BookChapter, type BookEdition } from '@/lib/book';
import type { PaperItemSnapshot } from '@/types/problem-bank';
import { buildBookInnerBlocks } from './inner-blocks';

/** 무선제본 내지는 쪽 수가 4의 배수여야 한다(열림인쇄 가이드) */
export const BOOK_PAGE_MULTIPLE = 4;

interface BookInnerViewProps {
  book: Book;
  edition: BookEdition;
  chapters: readonly BookChapter[];
  itemsByPaper: ReadonlyMap<string, PaperItemSnapshot[]>;
  imageUrls: Map<string, string>;
  /** 배치가 정해지면 쪽 수를 받는다(안정적인 참조) */
  onLayout: LayoutHandler;
}

/**
 * 책 내지 한 판 — 문제지 인쇄 엔진(`A4Document`) 한 벌에 장을 이어 싣는다.
 *
 * 장은 `breakBefore` 로 새 쪽(기본은 오른쪽 면)에서 시작하고, 끝에 빈 쪽을 붙여 쪽 수를 4의 배수로 맞춘다
 * (`padPagesTo`). 쪽 번호는 책 전체로 이어진다. 표지는 따로 뽑으므로 여기에 넣지 않는다.
 * 정답 및 해설 판은 답지 격자가 1단 폭을 쓰므로 늘 1단이다.
 */
export default function BookInnerView({
  book, edition, chapters, itemsByPaper, imageUrls, onLayout,
}: BookInnerViewProps) {
  const { chapterStart, trimWorks, columns } = book.settings;
  // 블록과 쪽 넘김은 한 useMemo 에서 — 참조가 안정적이어야 엔진이 렌더마다 다시 재지 않는다
  const { blocks, breakBefore } = useMemo(
    () => buildBookInnerBlocks({ edition, chapters, itemsByPaper, settings: { chapterStart, trimWorks }, imageUrls }),
    [edition, chapters, itemsByPaper, chapterStart, trimWorks, imageUrls],
  );
  const title = `${book.title}${EDITION_SUFFIX[edition]}`;
  const header = <CompactPageHeader title={title} />;

  return (
    <A4Document
      blocks={blocks}
      breakBefore={breakBefore}
      padPagesTo={BOOK_PAGE_MULTIPLE}
      onLayout={onLayout}
      columns={edition === 'key' ? 1 : columns}
      className={edition === 'key' ? 'pb-sheet' : 'pb-sheet pb-sheet--paper'}
      firstPageHeader={header}
      laterPageHeader={header}
    />
  );
}
