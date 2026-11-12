import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DEFAULT_BOOK_SETTINGS, type Book } from '@/lib/book';

vi.mock('./BookCoverMode', () => ({ default: () => <div data-testid="spread" /> }));
vi.mock('./BookCoverPanel', () => ({ default: () => <div data-testid="panel" /> }));
let stale = false;
const watched: (string | null)[] = [];
vi.mock('@/hooks/useBookRevisionWatch', () => ({
  useBookRevisionWatch: (_id: string, signature: string | null, withPageCounts: boolean) => {
    watched.push(signature);
    if (signature !== null && !withPageCounts) throw new Error('표지 화면은 쪽 수까지 견줘야 한다');
    return { stale, check: vi.fn(async () => false) };
  },
}));
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

  it('표지만 항목은 지켜보지 않는다(담긴 문제지가 없다)', () => {
    watched.length = 0;
    render(<BookCoverEditor book={book} state={state} />);
    expect(watched.every((w) => w === null)).toBe(true);
  });

  it('책 — 담긴 문제지가 다른 곳에서 고쳐졌으면 펼침면 대신 인쇄물에도 찍히는 안내를 그린다(코덱스 5R)', () => {
    stale = true;
    const real: Book = { ...book, kind: 'book', settings: { ...DEFAULT_BOOK_SETTINGS, manualPages: { student: 120 } } };
    render(<BookCoverEditor book={real} state={state} />);
    expect(screen.queryByTestId('spread')).toBeNull();
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toMatch(/다른 곳에서 고쳐져/);
    expect(alert.hasAttribute('data-no-print')).toBe(false);
    expect(watched.at(-1)).not.toBeNull();
    stale = false;
  });
});

