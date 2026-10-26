import { beforeAll, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { DEFAULT_BOOK_SETTINGS, type Book, type BookChapter } from '@/lib/book';
import type { PaperItemSnapshot, ProblemPaper } from '@/types/problem-bank';
import BookInnerView from './BookInnerView';
import { buildBookInnerBlocks, buildBookTocBlocks, tocBlockCount } from './inner-blocks';

const FOOTER_H = 20;

beforeAll(() => {
  // jsdom 은 배치를 하지 않는다 — 푸터만 높이를 주고 나머지는 0 (A4Document.test.tsx 와 같은 흉내)
  Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
    configurable: true,
    value(this: Element) {
      const height = this.matches?.('[data-measure="footer"]') ? FOOTER_H : 0;
      return { height, width: 0, top: 0, left: 0, right: 0, bottom: height, x: 0, y: 0, toJSON: () => ({}) };
    },
  });
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

function snap(n: number, over: Partial<PaperItemSnapshot> = {}): PaperItemSnapshot {
  return {
    number: n, question_type: '객관식', stem_html: `<p>물음 ${n}</p>`,
    choices: ['가', '나', '다', '라', '마'], answer: '3', score: null,
    explanation_html: '', area_path: [], work_title: '', render_mode: 'text',
    image_path: '', figure_paths: [], passage: null,
    source: {
      source_type: '내신기출', title: '성수고 중간', school_name: '성수고등학교',
      year: '2026', grade: '고1', exam_type: '중간', publisher: '',
    },
    ...over,
  };
}

function paper(id: string, title: string): ProblemPaper {
  return {
    id, title, settings: { columns: 2, showScore: false, showSource: true, omr: false },
    source_labels: ['2026 고1 성수고 중간'], total_questions: 2, user_id: 'u', updated_by: null,
    created_at: '2026-10-25T00:00:00Z', updated_at: '2026-10-25T00:00:00Z',
  };
}

const chapters: BookChapter[] = [
  { id: 'c1', bookId: 'b', paperId: 'p1', orderIndex: 0, titleOverride: '', paper: paper('p1', '현대시') },
  { id: 'c2', bookId: 'b', paperId: 'p2', orderIndex: 1, titleOverride: '고전시가 모음', paper: paper('p2', '고전') },
];
const itemsByPaper = new Map([
  ['p1', [snap(1), snap(2)]],
  ['p2', [snap(1, { question_type: '주관식', answer: '님', choices: [] })]],
]);

/** 목차 없는 책 — 장 배치만 본다 */
const book: Book = {
  id: 'b', title: '국어 문학', kind: 'book', finishedAt: null, settings: { ...DEFAULT_BOOK_SETTINGS, toc: false },
  pageCounts: {}, cover: null, userId: 'u', createdAt: '2026-10-25T00:00:00Z', updatedAt: '2026-10-25T00:00:00Z',
};

describe('buildBookInnerBlocks', () => {
  it('블록과 쪽 넘김이 같은 길이이고 장 머리만 설정값을 받는다', () => {
    for (const edition of ['student', 'teacher', 'key'] as const) {
      const { blocks, breakBefore } = buildBookInnerBlocks({
        edition, chapters, itemsByPaper, settings: { chapterStart: 'odd', trimWorks: true }, imageUrls: new Map(),
      });
      expect(blocks).toHaveLength(breakBefore.length);
      expect(breakBefore.filter(Boolean)).toEqual(['odd', 'odd']);
      expect(breakBefore[0]).toBe('odd');
    }
  });

  it('장 머리에 장 번호·제목(적은 제목 우선)·출처가 찍힌다', () => {
    const { blocks, breakBefore } = buildBookInnerBlocks({
      edition: 'student', chapters, itemsByPaper, settings: { chapterStart: 'page', trimWorks: true }, imageUrls: new Map(),
    });
    const heads = blocks.filter((_, i) => breakBefore[i] === 'page');
    const { container } = render(<>{heads.map((b, i) => <div key={i}>{b}</div>)}</>);
    const titles = Array.from(container.querySelectorAll('.bk-chapter')).map((el) => el.textContent);
    expect(titles[0]).toContain('1장');
    expect(titles[0]).toContain('현대시');
    expect(titles[1]).toContain('2장');
    expect(titles[1]).toContain('고전시가 모음');
    expect(titles[0]).toContain('2026 고1 성수고 중간');
  });

  it('장 머리 자리(chapterBlocks)는 쪽 넘김이 걸린 블록 자리와 같다', () => {
    for (const edition of ['student', 'teacher', 'key'] as const) {
      const { breakBefore, chapterBlocks } = buildBookInnerBlocks({
        edition, chapters, itemsByPaper, settings: { chapterStart: 'odd', trimWorks: true }, imageUrls: new Map(),
      });
      const breaks = breakBefore.flatMap((b, i) => (b ? [i] : []));
      expect(chapterBlocks).toEqual(breaks);
    }
  });

  it('정답 및 해설 판은 장마다 번호가 1부터인 빠른 정답 격자다', () => {
    const { blocks } = buildBookInnerBlocks({
      edition: 'key', chapters, itemsByPaper, settings: { chapterStart: 'odd', trimWorks: true }, imageUrls: new Map(),
    });
    const { container } = render(<>{blocks.map((b, i) => <div key={i}>{b}</div>)}</>);
    const nums = Array.from(container.querySelectorAll('.pb-answer-row .pb-answer-num')).map((el) => el.textContent);
    expect(nums).toEqual(['1', '2', '1']);
  });
});

describe('buildBookTocBlocks — 목차', () => {
  it('머리 하나 + 장마다 한 줄 — 길이는 tocBlockCount 와 같다(쪽 넘김을 이 수로 만든다)', () => {
    expect(buildBookTocBlocks({ chapters, chapterPages: null })).toHaveLength(tocBlockCount(chapters.length));
    expect(buildBookTocBlocks({ chapters: chapters.slice(0, 1), chapterPages: null })).toHaveLength(tocBlockCount(1));
    expect(buildBookTocBlocks({ chapters: [], chapterPages: null })).toHaveLength(0);
    expect(tocBlockCount(0)).toBe(0);
  });

  it('쪽을 모르면 칸만 세우고(글자 없음), 알면 장마다 시작 쪽을 찍는다', () => {
    const draw = (pages: readonly (number | null)[] | null) => render(
      <>{buildBookTocBlocks({ chapters, chapterPages: pages }).map((b, i) => <div key={i}>{b}</div>)}</>,
    ).container;
    const pending = draw(null);
    expect(pending.querySelector('.bk-toc__head')!.textContent).toBe('목차');
    const rows = Array.from(pending.querySelectorAll('.bk-toc__row'));
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('1장');
    expect(rows[0].textContent).toContain('현대시');
    expect(rows[1].textContent).toContain('고전시가 모음');
    expect(pending.querySelectorAll('.bk-toc__page[data-pending]')).toHaveLength(2);

    const filled = draw([3, 5]);
    expect(Array.from(filled.querySelectorAll('.bk-toc__page')).map((el) => el.textContent)).toEqual(['3', '5']);
    expect(filled.querySelector('.bk-toc__page[data-pending]')).toBeNull();
  });
});

describe('BookInnerView — 엔진과 함께', () => {
  const sheets = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>('.a4-stack .a4-sheet'));

  it('2장은 오른쪽 면(3쪽)에서 시작하고 끝에 빈 쪽을 붙여 4쪽이다', () => {
    const counts: number[] = [];
    const { container } = render(
      <BookInnerView
        book={book} edition="student" chapters={chapters} itemsByPaper={itemsByPaper}
        imageUrls={new Map()} onLayout={({ pageCount }) => counts.push(pageCount)}
      />,
    );
    const rendered = sheets(container);
    expect(rendered).toHaveLength(4);
    expect(rendered.map((s) => s.classList.contains('a4-sheet--blank'))).toEqual([false, true, false, true]);
    expect(rendered[2].querySelector('.bk-chapter')!.textContent).toContain('2장');
    expect(rendered[0].querySelector('.a4-compact-header')!.textContent).toContain('국어 문학');
    expect(counts.at(-1)).toBe(4);
  });

  it('목차를 넣으면 1쪽이 목차, 장은 오른쪽 면(3·5쪽)에서 시작하고 목차에 그 쪽이 찍힌다 — 채워도 다시 배치하지 않는다', () => {
    const counts: number[] = [];
    const withToc: Book = { ...book, settings: { ...book.settings, toc: true } };
    const { container } = render(
      <BookInnerView
        book={withToc} edition="student" chapters={chapters} itemsByPaper={itemsByPaper}
        imageUrls={new Map()} onLayout={({ pageCount }) => counts.push(pageCount)}
      />,
    );
    const rendered = sheets(container);
    expect(rendered).toHaveLength(8);
    // 목차 · 빈 · 1장 · 빈 · 2장 · 4의 배수 채움 셋
    expect(rendered.map((s) => s.classList.contains('a4-sheet--blank')))
      .toEqual([false, true, false, true, false, true, true, true]);
    expect(rendered[0].querySelector('.bk-toc__head')).not.toBeNull();
    expect(rendered[2].querySelector('.bk-chapter')!.textContent).toContain('1장');
    expect(rendered[4].querySelector('.bk-chapter')!.textContent).toContain('2장');
    const pages = Array.from(rendered[0].querySelectorAll('.bk-toc__page')).map((el) => el.textContent);
    expect(pages).toEqual(['3', '5']);
    // 쪽 번호를 채워도 블록 높이가 같아 엔진이 다시 알리지 않는다(수렴) — 알림은 한 번뿐
    expect(counts).toEqual([8]);
  });

  it('목차를 끄면 목차 블록이 없다', () => {
    const { container } = render(
      <BookInnerView
        book={book} edition="student" chapters={chapters} itemsByPaper={itemsByPaper}
        imageUrls={new Map()} onLayout={() => {}}
      />,
    );
    expect(container.querySelector('.bk-toc')).toBeNull();
  });

  it('교사용 판은 머리글에 꼬리가 붙는다', () => {
    const { container } = render(
      <BookInnerView
        book={book} edition="teacher" chapters={chapters} itemsByPaper={itemsByPaper}
        imageUrls={new Map()} onLayout={() => {}}
      />,
    );
    expect(sheets(container)[0].querySelector('.a4-compact-header')!.textContent).toContain('국어 문학 - 교사용');
  });
});
