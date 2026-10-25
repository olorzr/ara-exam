import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DEFAULT_BOOK_SETTINGS, type Book } from '@/lib/book';

vi.mock('./BookCoverMode', () => ({ default: () => <div data-testid="spread" /> }));
vi.mock('./BookCoverPanel', () => ({ default: () => <div data-testid="panel" /> }));
const { default: BookCoverEditor } = await import('./BookCoverEditor');

const book: Book = {
  id: 'b', title: '표지', kind: 'cover', finishedAt: null,
  settings: { ...DEFAULT_BOOK_SETTINGS, manualPages: { student: 120 } }, pageCounts: {}, cover: null,
  userId: 'u', createdAt: '', updatedAt: '',
};
const state = { chapters: [], creatorName: '', setFinished: vi.fn() } as never;

describe('BookCoverEditor', () => {
  it('오른쪽 칸은 바깥 상자째 인쇄에서 빠진다(코덱스 3R — 빈 flex 칸이 빈 둘째 쪽을 만든다)', () => {
    render(<BookCoverEditor book={book} state={state} />);
    const side = screen.getByTestId('book-cover-side');
    expect(side.hasAttribute('data-no-print')).toBe(true);
    expect(side.contains(screen.getByTestId('panel'))).toBe(true);
    // 펼침면은 인쇄에 남는다
    expect(screen.getByTestId('spread').closest('[data-no-print]')).toBeNull();
  });

  it('쪽 수가 없으면 펼침면 대신 안내만(인쇄에서 빠진다)', () => {
    render(<BookCoverEditor book={{ ...book, settings: DEFAULT_BOOK_SETTINGS }} state={state} />);
    expect(screen.queryByTestId('spread')).toBeNull();
    expect(screen.getByText(/내지 쪽 수/).closest('[data-no-print]')).not.toBeNull();
  });
});
