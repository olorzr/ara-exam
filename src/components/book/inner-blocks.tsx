import type { ReactNode } from 'react';
import { buildAnswerRows, explanationEntries } from '@/lib/problem-paper/answers';
import { buildPaperBlocks } from '@/lib/problem-paper/blocks';
import { DEFAULT_PAPER_SETTINGS } from '@/lib/problem-paper/settings';
import type { BreakBefore } from '@/lib/print/paginate';
import { chapterTitleOf, type BookChapter, type BookEdition, type BookSettings } from '@/lib/book';
import type { PaperItemSnapshot } from '@/types/problem-bank';
import { renderAnswerKeyBlocks } from '@/components/problem-paper/AnswerKeyBlocks';
import { renderPaperBlocks } from '@/components/problem-paper/PaperPrintBlocks';
import BookChapterHeading from './BookChapterHeading';

/** 내지 블록을 짓는 데 필요한 것 */
export interface BookInnerInput {
  edition: BookEdition;
  chapters: readonly BookChapter[];
  /** 문제지 id → 항목 스냅샷 */
  itemsByPaper: ReadonlyMap<string, PaperItemSnapshot[]>;
  settings: Pick<BookSettings, 'chapterStart' | 'trimWorks'>;
  /** Storage 경로 → 서명 URL */
  imageUrls: Map<string, string>;
}

/** 엔진에 넘길 블록과, 블록마다의 강제 쪽 넘김 */
export interface BookInnerBlocks {
  blocks: ReactNode[];
  breakBefore: BreakBefore[];
}

/**
 * 책 내지의 블록 — 장마다 장 머리 + 그 문제지의 본문(학생용·교사용) 또는 답지(정답 및 해설).
 *
 * ⚠️ 블록과 `breakBefore` 를 **한 루프에서** 함께 만든다 — 따로 만들면 길이·자리가 어긋나 엉뚱한 블록 앞에서
 *    쪽이 넘어간다. 장 머리만 `settings.chapterStart` 를 받고 나머지는 `false` 다.
 * 본문은 문제지 인쇄와 **같은 함수**(`buildPaperBlocks`·`renderPaperBlocks`·`renderAnswerKeyBlocks`)로 그린다 —
 * 번호는 장마다 1부터(문제지 안의 자리), 출처 표시는 그 문제지의 설정을 따른다.
 * @param input - 판·장·항목·설정·이미지
 * @returns 블록과 쪽 넘김
 */
export function buildBookInnerBlocks(input: BookInnerInput): BookInnerBlocks {
  const { edition, chapters, itemsByPaper, settings, imageUrls } = input;
  const blocks: ReactNode[] = [];
  const breakBefore: BreakBefore[] = [];
  const push = (node: ReactNode, brk: BreakBefore) => {
    blocks.push(node);
    breakBefore.push(brk);
  };

  chapters.forEach((chapter, index) => {
    const items = itemsByPaper.get(chapter.paperId) ?? [];
    push(
      <BookChapterHeading
        number={index + 1}
        title={chapterTitleOf(chapter)}
        sources={chapter.paper?.source_labels ?? []}
      />,
      settings.chapterStart,
    );

    const body = edition === 'key'
      ? renderAnswerKeyBlocks(buildAnswerRows(items), explanationEntries(items), `ch${index}-`)
      : renderPaperBlocks({
        blocks: buildPaperBlocks(items, edition === 'teacher', { trimWorks: settings.trimWorks }),
        settings: chapter.paper?.settings ?? DEFAULT_PAPER_SETTINGS,
        imageUrls,
        showAnswers: edition === 'teacher',
        omrSheetCount: 0,
      });
    body.forEach((node) => push(node, false));
  });

  return { blocks, breakBefore };
}
