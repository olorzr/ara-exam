import { render } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_BOOK_SETTINGS, type Book, type BookChapter } from '@/lib/book';
import { stubPrintLayout } from '@/test-utils/print-layout-stub';
import type { PaperItemSnapshot, PaperPassageSnapshot, ProblemPaper } from '@/types/problem-bank';
import BookInnerView from './BookInnerView';

/**
 * 책 내지의 긴 지문 — 목차가 앞에 있어 엔진의 블록 자리와 쪼개기 훅의 자리가 어긋난 채로 돈다(`blockOffset`).
 * 그 차이를 빠뜨리면 엉뚱한 블록을 재거나 조각이 장 머리 자리를 밀어 목차 쪽 번호가 틀린다.
 */

beforeAll(() => stubPrintLayout({ firstHeader: 30, laterHeader: 30 }));

const LINES = Array.from({ length: 120 }, (_, i) => `시구${i + 1}`);

const passage: PaperPassageSnapshot = {
  id: 'p', label: '[1]', title: '', author: '', render_mode: 'text', image_path: '', figure_paths: [],
  html: `<blockquote data-box="가"><p>${LINES.join('<br>')}</p></blockquote>`,
};

const snap = (over: Partial<PaperItemSnapshot> = {}): PaperItemSnapshot => ({
  number: 1, question_type: '객관식', stem_html: '<p>물음</p>', choices: ['가', '나', '다', '라', '마'], answer: '3',
  score: null, explanation_html: '', area_path: [], work_title: '', render_mode: 'text', image_path: '',
  figure_paths: [], passage: null,
  source: { source_type: '내신기출', title: '', school_name: '성수고', year: '2026', grade: '고1', exam_type: '중간', publisher: '' },
  ...over,
});

const paper = (id: string): ProblemPaper => ({
  id, title: id, settings: { columns: 2, showScore: false, showSource: false, omr: false }, source_labels: [],
  total_questions: 1, user_id: 'u', updated_by: null, created_at: '2026-10-25T00:00:00Z', updated_at: '2026-10-25T00:00:00Z',
});

const chapters: BookChapter[] = [
  { id: 'c1', bookId: 'b', paperId: 'p1', orderIndex: 0, titleOverride: '', paper: paper('p1') },
  { id: 'c2', bookId: 'b', paperId: 'p2', orderIndex: 1, titleOverride: '', paper: paper('p2') },
];
const itemsByPaper = new Map([['p1', [snap({ passage })]], ['p2', [snap()]]]);

function draw(toc: boolean, onLayout: () => void = () => {}) {
  const book: Book = {
    id: 'b', title: '문학', kind: 'book', finishedAt: null, settings: { ...DEFAULT_BOOK_SETTINGS, columns: 1, toc },
    pageCounts: {}, cover: null, userId: 'u', createdAt: '2026-10-25T00:00:00Z', updatedAt: '2026-10-25T00:00:00Z',
  };
  const { container } = render(
    <BookInnerView book={book} edition="student" chapters={chapters} itemsByPaper={itemsByPaper} imageUrls={new Map()} onLayout={onLayout} />,
  );
  return container.querySelector('.a4-stack') as HTMLElement;
}

const verseLines = (stack: HTMLElement) => Array.from(stack.querySelectorAll('.pb-passage-part p'))
  .flatMap((p) => p.innerHTML.split('<br>'));
const sheetOf = (stack: HTMLElement, text: string) => Array.from(stack.querySelectorAll('.a4-sheet'))
  .findIndex((sheet) => Array.from(sheet.querySelectorAll('.bk-chapter')).some((el) => el.textContent?.includes(text)));

describe('BookInnerView — 긴 지문', () => {
  it.each([[true], [false]])('목차 %s 에서 쪼개져 줄어들지 않고 줄이 그대로다', (toc) => {
    const stack = draw(toc);
    expect(stack.querySelector('.a4-block--scaled')).toBeNull();
    expect(verseLines(stack)).toEqual(LINES);
    expect(stack.querySelectorAll('.pb-passage-part').length).toBeGreaterThan(1);
  });

  it('목차의 쪽 번호가 쪼갠 뒤의 장 자리다', () => {
    const stack = draw(true);
    const pages = Array.from(stack.querySelectorAll('.bk-toc__page')).map((el) => el.textContent);
    expect(pages).toEqual([String(sheetOf(stack, '1장') + 1), String(sheetOf(stack, '2장') + 1)]);
    // 1장이 쪽을 넘어 흘렀으므로 2장은 그만큼 뒤다
    expect(sheetOf(stack, '2장')).toBeGreaterThan(sheetOf(stack, '1장') + 1);
  });

  it('장은 쪼갠 뒤에도 오른쪽 면에서 시작하고 쪽 수는 4의 배수다', () => {
    const stack = draw(true);
    expect(sheetOf(stack, '2장') % 2).toBe(0);
    expect(stack.querySelectorAll('.a4-sheet').length % 4).toBe(0);
  });
});
