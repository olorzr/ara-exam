import type { ReactNode } from 'react';
import type { PassageSplitAdapter } from '@/hooks/usePassageSplit';
import { buildAnswerRows, explanationEntries } from '@/lib/problem-paper/answers';
import { buildPaperBlocks, type PaperBlock } from '@/lib/problem-paper/blocks';
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
 * 내지 목록의 한 칸 — 긴 지문을 자리에 맞춰 쪼갤 수 있게 그리기 전의 모양으로 든다(`usePassageSplit`).
 * ⚠️ 이미지 URL 에 기대지 않는 값만 담는다 — 서명이 뒤늦게 왔다고 목록이 바뀌면 쪼갠 것이 풀린다.
 */
export type BookBlock =
  | { kind: 'head'; node: ReactNode }
  | { kind: 'paper'; block: PaperBlock; chapterIndex: number }
  /** 정답 및 해설 판의 답지 블록 */
  | { kind: 'node'; node: ReactNode };

/** 책의 지문 쪼개기 어댑터 */
export const BOOK_SPLIT_ADAPTER: PassageSplitAdapter<BookBlock> = {
  partOf: (entry) => (entry.kind === 'paper' && entry.block.kind === 'passage-part' ? entry.block : null),
  wrap: (entry, chunk) => (entry.kind === 'paper' ? { ...entry, block: chunk } : entry),
};

/**
 * 책 내지의 목록 — 장마다 장 머리 + 그 문제지의 본문(학생용·교사용) 또는 답지(정답 및 해설).
 *
 * 본문은 문제지 인쇄와 **같은 함수**(`buildPaperBlocks`·`renderAnswerKeyBlocks`)로 짓는다 —
 * 번호는 장마다 1부터(문제지 안의 자리)다.
 * @param input - 판·장·항목·설정
 * @returns 내지 목록
 */
export function buildBookInnerList(input: Omit<BookInnerInput, 'imageUrls'>): BookBlock[] {
  const { edition, chapters, itemsByPaper, settings } = input;
  const list: BookBlock[] = [];
  chapters.forEach((chapter, index) => {
    const items = itemsByPaper.get(chapter.paperId) ?? [];
    list.push({
      kind: 'head',
      node: (
        <BookChapterHeading
          number={index + 1}
          title={chapterTitleOf(chapter)}
          sources={chapter.paper?.source_labels ?? []}
        />
      ),
    });
    if (edition === 'key') {
      renderAnswerKeyBlocks(buildAnswerRows(items), explanationEntries(items), `ch${index}-`)
        .forEach((node) => list.push({ kind: 'node', node }));
      return;
    }
    buildPaperBlocks(items, edition === 'teacher', { trimWorks: settings.trimWorks })
      .forEach((block) => list.push({ kind: 'paper', block, chapterIndex: index }));
  });
  return list;
}

/** 목록을 그리는 데 필요한 것 */
type BookRenderContext = Pick<BookInnerInput, 'edition' | 'chapters' | 'imageUrls'> & {
  settings: Pick<BookSettings, 'chapterStart'>;
};

/**
 * 목록을 엔진에 넘길 블록으로 그린다.
 *
 * ⚠️ 블록과 `breakBefore` 를 **한 루프에서** 함께 만든다 — 따로 만들면 길이·자리가 어긋나 엉뚱한 블록 앞에서
 *    쪽이 넘어간다. 장 머리만 `settings.chapterStart` 를 받고 나머지는 `false` 다. 지문을 쪼갠 **뒤의** 목록을
 *    넘기므로 장 머리 자리도 쪼갠 뒤의 자리다. 출처 표시는 그 문제지의 설정을 따른다.
 * @param list - 내지 목록
 * @param context - 판·장·설정·이미지
 * @returns 블록과 쪽 넘김
 */
export function renderBookInnerBlocks(list: readonly BookBlock[], context: BookRenderContext): BookInnerBlocks {
  const { edition, chapters, settings, imageUrls } = context;
  const blocks: ReactNode[] = [];
  const breakBefore: BreakBefore[] = [];
  const chapterBlocks: number[] = [];
  const push = (node: ReactNode, brk: BreakBefore) => {
    blocks.push(node);
    breakBefore.push(brk);
  };

  // 문제지 블록은 장마다 한 번에 그린다 — 그 문제지의 설정을 쓴다
  let run: PaperBlock[] = [];
  let runChapter = -1;
  const flush = () => {
    if (run.length === 0) return;
    renderPaperBlocks({
      blocks: run,
      settings: chapters[runChapter]?.paper?.settings ?? DEFAULT_PAPER_SETTINGS,
      imageUrls,
      showAnswers: edition === 'teacher',
      omrSheetCount: 0,
    }).forEach((node) => push(node, false));
    run = [];
  };

  for (const entry of list) {
    if (entry.kind === 'paper') {
      if (entry.chapterIndex !== runChapter) flush();
      runChapter = entry.chapterIndex;
      run.push(entry.block);
      continue;
    }
    flush();
    if (entry.kind === 'head') chapterBlocks.push(blocks.length);
    push(entry.node, entry.kind === 'head' ? settings.chapterStart : false);
  }
  flush();

  return { blocks, breakBefore, chapterBlocks };
}

/**
 * 쪼개지 않은 내지 블록 — 목록을 짓고 그대로 그린다.
 * @param input - 판·장·항목·설정·이미지
 * @returns 블록과 쪽 넘김
 */
export function buildBookInnerBlocks(input: BookInnerInput): BookInnerBlocks {
  return renderBookInnerBlocks(buildBookInnerList(input), input);
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
