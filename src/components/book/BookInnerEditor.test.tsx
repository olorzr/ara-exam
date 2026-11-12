import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_BOOK_SETTINGS, type Book } from '@/lib/book';

let stale = false;
const watched: { signature: string | null; withPageCounts: boolean }[] = [];
vi.mock('@/hooks/useBookRevisionWatch', () => ({
  useBookRevisionWatch: (_id: string, signature: string | null, withPageCounts: boolean) => {
    watched.push({ signature, withPageCounts });
    return { stale, check: vi.fn(async () => false) };
  },
}));
vi.mock('./BookInnerMode', () => ({ default: () => <div data-testid="inner" /> }));
vi.mock('./BookComposePanel', () => ({ default: () => <div data-testid="compose" /> }));
vi.mock('./BookToolbar', () => ({
  INNER_MODES: ['compose', 'inner'],
  default: ({ onModeChange }: { onModeChange: (m: string) => void }) => (
    <button type="button" onClick={() => onModeChange('inner')}>내지</button>
  ),
}));
const { default: BookInnerEditor } = await import('./BookInnerEditor');

const book: Book = {
  id: 'b', title: '책', kind: 'book', finishedAt: null, settings: DEFAULT_BOOK_SETTINGS, pageCounts: {}, cover: null,
  userId: 'u', createdAt: '', updatedAt: '',
};
const state = {
  chapters: [{ id: 'c', bookId: 'b', paperId: 'p1', orderIndex: 0, titleOverride: '', paper: { updated_at: 'v1' } }],
  creatorName: '', setFinished: vi.fn(), savePageCount: vi.fn(),
} as never;

beforeEach(() => { stale = false; watched.length = 0; });

describe('BookInnerEditor — 다른 곳에서 고쳐짐(sql/103)', () => {
  it('담긴 문제지 판만 지켜본다(쪽 수는 이 화면이 스스로 저장한다)', () => {
    render(<BookInnerEditor book={book} state={state} />);
    expect(watched.at(-1)?.withPageCounts).toBe(false);
    expect(watched.at(-1)?.signature).toContain('v1');
  });

  it('고쳐졌으면 내지 대신 인쇄물에도 찍히는 안내를 그린다', () => {
    stale = true;
    render(<BookInnerEditor book={book} state={state} />);
    fireEvent.click(screen.getByRole('button', { name: '내지' }));
    expect(screen.queryByTestId('inner')).toBeNull();
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toMatch(/다른 곳에서 고쳐졌어요/);
    expect(alert.hasAttribute('data-no-print')).toBe(false);
  });
});
