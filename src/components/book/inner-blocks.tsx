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
import { BookTocHeading, BookTocRow } from './BookToc';

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
  /** 장마다 장 머리 블록의 자리(이 결과 안의 인덱스) — 목차가 장의 시작 쪽을 찾는 데 쓴다 */
  chapterBlocks: number[];
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
  const chapterBlocks: number[] = [];
  const push = (node: ReactNode, brk: BreakBefore) => {
    blocks.push(node);
    breakBefore.push(brk);
  };

  chapters.forEach((chapter, index) => {
    const items = itemsByPaper.get(chapter.paperId) ?? [];
    chapterBlocks.push(blocks.length);
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

  return { blocks, breakBefore, chapterBlocks };
}

/** 목차 블록을 짓는 데 필요한 것 */
export interface BookTocInput {
  chapters: readonly BookChapter[];
  /** 장마다 인쇄 쪽 번호 — 엔진이 배치를 알리기 전에는 null(칸만 세운다) */
  chapterPages: readonly (number | null)[] | null;
}

/**
 * 목차 블록 수 — 머리 하나 + 장마다 한 줄. 내지 화면이 이 수로 목차 몫의 쪽 넘김(전부 `false`)을 먼저 만든다 —
 * 쪽 번호가 채워져 목차 블록이 바뀌어도 쪽 넘김 배열의 참조가 그대로라야 엔진이 측정 함수를 새로 만들지 않는다.
 * ⚠️ `buildBookTocBlocks` 의 길이와 같아야 한다(테스트가 고정한다).
 * @param chapterCount - 장 수
 * @returns 목차 블록 수(장이 없으면 0)
 */
export function tocBlockCount(chapterCount: number): number {
  return chapterCount > 0 ? chapterCount + 1 : 0;
}

/**
 * 목차 블록 — 머리 + 장마다 한 줄(장 번호 · 제목 · 시작 쪽). 내지 맨 앞에 싣고, 쪽 넘김은 모두 없음이다
 * (1장의 장 머리가 `chapterStart` 로 다음 쪽에서 시작한다). 줄이 블록 하나씩이라 장이 많으면 단·쪽을 넘어 흐른다.
 * @param input - 장 · 장마다 시작 쪽
 * @returns 블록(장이 없으면 빈 배열)
 */
export function buildBookTocBlocks({ chapters, chapterPages }: BookTocInput): ReactNode[] {
  if (chapters.length === 0) return [];
  return [
    <BookTocHeading key="toc-head" />,
    ...chapters.map((chapter, index) => (
      <BookTocRow
        key={chapter.id}
        number={index + 1}
        title={chapterTitleOf(chapter)}
        page={chapterPages?.[index] ?? null}
      />
    )),
  ];
}
