import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_BOOK_SETTINGS, type Book, type BookChapter } from '@/lib/book';
import type { PaperItemSnapshot } from '@/types/problem-bank';

const m = vi.hoisted(() => ({ items: new Map<string, unknown[]>() }));
vi.mock('@/hooks/useBookChapterItems', () => ({
  useBookChapterItems: () => ({ items: m.items, loading: false, failed: false, reload: vi.fn() }),
}));
vi.mock('@/hooks/useSignedImageUrls', () => ({
  useSignedImageUrls: (paths: string[]) => ({
    urls: new Map(paths.map((p) => [p, `https://x/${p}`])), loading: false, missing: [], reload: vi.fn(),
  }),
}));
vi.mock('@/hooks/useImagesReady', () => ({ useImagesReady: () => ({ loading: false, failed: [] }) }));

const { default: BookInnerMode } = await import('./BookInnerMode');

beforeAll(() => {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});

const snap = (n: number, over: Partial<PaperItemSnapshot> = {}): PaperItemSnapshot => ({
  number: n, question_type: '객관식', stem_html: '<p>물음</p>', choices: ['가', '나', '다', '라', '마'],
  answer: '3', score: null, explanation_html: '', area_path: [], work_title: '', render_mode: 'text',
  image_path: '', figure_paths: [], passage: null,
  source: { source_type: '내신기출', title: 't', school_name: '학교', year: '2026', grade: '고1', exam_type: '중간', publisher: '' },
  ...over,
});
const chapters: BookChapter[] = [{ id: 'c', bookId: 'b', paperId: 'p', orderIndex: 0, titleOverride: '', paper: null }];
const book: Book = {
  id: 'b', title: '책', kind: 'book', finishedAt: null, settings: DEFAULT_BOOK_SETTINGS, pageCounts: {}, cover: null,
  userId: 'u', createdAt: '', updatedAt: '',
};
const unchanged = () => Promise.resolve(false);

describe('BookInnerMode — 번호 어긋남 경고(코덱스 2R)', () => {
  beforeEach(() => {
    // 원본 17번을 1번 자리에 이미지로 실었다 — 이미지에 '17' 이 찍혀 있다
    m.items = new Map([['p', [snap(17, { render_mode: 'image', image_path: 'problems/x/region.jpg' })]]]);
  });

  it('확인 전에는 인쇄에만 보이는 경고 덮개가 있고, 확인하면 걷힌다', () => {
    render(<BookInnerMode book={book} chapters={chapters} edition="student" savePageCount={vi.fn(async () => true)} checkRevision={unchanged} />);
    expect(document.querySelector('.bk-print-warning')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /인쇄물에서 경고 빼기/ }));
    expect(document.querySelector('.bk-print-warning')).toBeNull();
  });

  it('인쇄 단추는 판을 확인한 뒤 묻고, 확인하면 경고를 걷은 뒤 인쇄한다', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const check = vi.fn(unchanged);
    render(<BookInnerMode book={book} chapters={chapters} edition="student" savePageCount={vi.fn(async () => true)} checkRevision={check} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /내지 인쇄/ })); });
    expect(check).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalled();
    expect(document.querySelector('.bk-print-warning')).toBeNull();
    expect(print).toHaveBeenCalledTimes(1);
    print.mockRestore();
    confirm.mockRestore();
  });

  it('정답 및 해설 판에는 경고가 없다(이미지를 찍지 않는다)', () => {
    render(<BookInnerMode book={book} chapters={chapters} edition="key" savePageCount={vi.fn(async () => true)} checkRevision={unchanged} />);
    expect(document.querySelector('.bk-print-warning')).toBeNull();
  });

  it('인쇄 직전에 담긴 문제지가 고쳐진 것을 알면 묻지도 인쇄하지도 않는다(코덱스 10R)', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<BookInnerMode book={book} chapters={chapters} edition="student" savePageCount={vi.fn(async () => true)} checkRevision={() => Promise.resolve(true)} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /내지 인쇄/ })); });
    expect(confirm).not.toHaveBeenCalled();
    expect(print).not.toHaveBeenCalled();
    print.mockRestore();
    confirm.mockRestore();
  });
});
