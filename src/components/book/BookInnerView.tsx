'use client';

import { useCallback, useMemo, useState } from 'react';
import { A4Document, CompactPageHeader } from '@/components/print';
import type { LayoutHandler } from '@/hooks/useA4Pagination';
import type { BreakBefore } from '@/lib/print/paginate';
import { EDITION_SUFFIX, type Book, type BookChapter, type BookEdition } from '@/lib/book';
import type { PaperItemSnapshot } from '@/types/problem-bank';
import { buildBookInnerBlocks, buildBookTocBlocks, tocBlockCount } from './inner-blocks';

/** 무선제본 내지는 쪽 수가 4의 배수여야 한다(열림인쇄 가이드) */
export const BOOK_PAGE_MULTIPLE = 4;

/** 장마다 시작 쪽 — 엔진이 배치를 알리기 전에는 null */
type ChapterPages = readonly (number | null)[];

interface BookInnerViewProps {
  book: Book;
  edition: BookEdition;
  chapters: readonly BookChapter[];
  itemsByPaper: ReadonlyMap<string, PaperItemSnapshot[]>;
  imageUrls: Map<string, string>;
  /** 배치가 정해지면 쪽 수를 받는다(안정적인 참조) */
  onLayout: LayoutHandler;
}

/** 두 쪽 번호 목록이 같은가 — 같으면 상태를 바꾸지 않는다(다시 그리지 않게) */
function samePages(a: ChapterPages | null, b: ChapterPages): boolean {
  return a !== null && a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * 책 내지 한 판 — 문제지 인쇄 엔진(`A4Document`) 한 벌에 (목차 +) 장을 이어 싣는다.
 *
 * 장은 `breakBefore` 로 새 쪽(기본은 오른쪽 면)에서 시작하고, 끝에 빈 쪽을 붙여 쪽 수를 4의 배수로 맞춘다
 * (`padPagesTo`). 쪽 번호는 책 전체로 이어진다. 표지는 따로 뽑으므로 여기에 넣지 않는다.
 * 정답 및 해설 판은 답지 격자가 1단 폭을 쓰므로 늘 1단이다.
 *
 * **목차**(설정 `toc`)는 맨 앞 블록들이다. 장의 시작 쪽은 엔진이 배치를 알린 뒤에야 알 수 있어 두 번에 그린다 —
 * 처음엔 쪽 칸을 비워 재고, 알림(`blockPages`)을 받으면 번호를 채운다. ⚠️ 쪽 칸은 폭이 고정이라 채워도 블록 높이가
 * 같다 → 엔진의 배치 서명이 그대로라 알림이 다시 오지 않는다(수렴). 쪽 넘김 배열은 번호와 무관한 값(`tocCount`)으로만
 * 만든다 — 번호가 채워질 때 참조가 바뀌면 엔진이 측정 함수를 새로 만들어 관찰자를 다시 건다.
 * 상태는 `BookInnerMode` 가 구성 지문(`key`)으로 다시 마운트할 때 비워진다.
 */
export default function BookInnerView({
  book, edition, chapters, itemsByPaper, imageUrls, onLayout,
}: BookInnerViewProps) {
  const { chapterStart, trimWorks, columns, toc } = book.settings;
  // 본문 블록은 쪽 번호와 무관하다 — 번호가 채워져도 문항 블록을 다시 만들지 않게 따로 든다
  const body = useMemo(
    () => buildBookInnerBlocks({ edition, chapters, itemsByPaper, settings: { chapterStart, trimWorks }, imageUrls }),
    [edition, chapters, itemsByPaper, chapterStart, trimWorks, imageUrls],
  );
  const [chapterPages, setChapterPages] = useState<ChapterPages | null>(null);
  const tocCount = toc ? tocBlockCount(chapters.length) : 0;
  const tocBlocks = useMemo(
    () => (tocCount > 0 ? buildBookTocBlocks({ chapters, chapterPages }) : []),
    [tocCount, chapters, chapterPages],
  );
  const blocks = useMemo(() => [...tocBlocks, ...body.blocks], [tocBlocks, body.blocks]);
  const breakBefore = useMemo<BreakBefore[]>(
    () => [...Array.from({ length: tocCount }, () => false as const), ...body.breakBefore],
    [tocCount, body.breakBefore],
  );
  const chapterBlocks = useMemo(
    () => body.chapterBlocks.map((i) => i + tocCount),
    [body.chapterBlocks, tocCount],
  );

  const handleLayout = useCallback<LayoutHandler>((info) => {
    onLayout(info);
    if (tocCount === 0) return;
    const next = chapterBlocks.map((i) => {
      const page = info.blockPages[i];
      return page === undefined || page < 0 ? null : page + 1;
    });
    setChapterPages((prev) => (samePages(prev, next) ? prev : next));
  }, [onLayout, tocCount, chapterBlocks]);

  const title = `${book.title}${EDITION_SUFFIX[edition]}`;
  const header = <CompactPageHeader title={title} />;

  return (
    <A4Document
      blocks={blocks}
      breakBefore={breakBefore}
      padPagesTo={BOOK_PAGE_MULTIPLE}
      onLayout={handleLayout}
      columns={edition === 'key' ? 1 : columns}
      className={edition === 'key' ? 'pb-sheet' : 'pb-sheet pb-sheet--paper'}
      firstPageHeader={header}
      laterPageHeader={header}
    />
  );
}
