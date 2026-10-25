import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { DEFAULT_BOOK_SETTINGS, type BookListItem } from '@/lib/book';

const m = vi.hoisted(() => ({
  fetchBooks: vi.fn(),
  createBook: vi.fn(),
  updateBook: vi.fn(),
  deleteBook: vi.fn(),
}));
vi.mock('@/lib/book', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/book')>()),
  fetchBooks: m.fetchBooks,
  createBook: m.createBook,
  updateBook: m.updateBook,
  deleteBook: m.deleteBook,
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { useBookList } = await import('./useBookList');

const row = (id: string, over: Partial<BookListItem> = {}): BookListItem => ({
  id, title: id, kind: 'book', finishedAt: null, settings: DEFAULT_BOOK_SETTINGS, pageCounts: {}, cover: null,
  userId: 'u', createdAt: '', updatedAt: '', chapterCount: 0, ...over,
});

describe('useBookList', () => {
  beforeEach(() => {
    m.fetchBooks.mockReset();
    m.updateBook.mockReset();
    m.createBook.mockReset();
  });

  it('조건을 그대로 넘기고, 원장 확인 전에는 묻지 않는다', async () => {
    m.fetchBooks.mockResolvedValue([row('a')]);
    const { result, rerender } = renderHook(({ enabled }) => useBookList(enabled, { kind: 'book', finished: false }), {
      initialProps: { enabled: false },
    });
    expect(m.fetchBooks).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.books.map((b) => b.id)).toEqual(['a']));
    expect(m.fetchBooks).toHaveBeenCalledWith({ kind: 'book', finished: false });
  });

  it('조건이 바뀌면 옛 목록을 새 조건의 것처럼 내주지 않는다', async () => {
    m.fetchBooks.mockResolvedValueOnce([row('a')]);
    const { result, rerender } = renderHook(({ finished }) => useBookList(true, { finished }), {
      initialProps: { finished: false },
    });
    await waitFor(() => expect(result.current.books).toHaveLength(1));
    let resolveDone!: (rows: BookListItem[]) => void;
    m.fetchBooks.mockReturnValueOnce(new Promise((r) => { resolveDone = r; }));
    rerender({ finished: true });
    expect(result.current.books).toEqual([]);
    expect(result.current.loading).toBe(true);
    await act(async () => { resolveDone([row('d', { finishedAt: '2026-10-26T00:00:00Z' })]); });
    expect(result.current.books.map((b) => b.id)).toEqual(['d']);
  });

  it('다 만든 표시를 바꾸면 시각(또는 null)을 보내고 이 목록에서 뺀다', async () => {
    m.fetchBooks.mockResolvedValue([row('a'), row('b')]);
    m.updateBook.mockResolvedValue(row('a'));
    const { result } = renderHook(() => useBookList(true, { finished: false }));
    await waitFor(() => expect(result.current.books).toHaveLength(2));
    await act(async () => { await result.current.setFinished(result.current.books[0], true); });
    expect(m.updateBook).toHaveBeenCalledWith('a', { finished_at: expect.any(String) });
    expect(result.current.books.map((b) => b.id)).toEqual(['b']);

    await act(async () => { await result.current.setFinished(result.current.books[0], false); });
    expect(m.updateBook).toHaveBeenLastCalledWith('b', { finished_at: null });
  });

  it('새 항목은 종류를 함께 보낸다', async () => {
    m.fetchBooks.mockResolvedValue([]);
    m.createBook.mockResolvedValue(row('n', { kind: 'cover' }));
    const { result } = renderHook(() => useBookList(true, { finished: false }));
    await act(async () => { await result.current.create('새 표지', 'cover'); });
    expect(m.createBook).toHaveBeenCalledWith('새 표지', 'cover');
  });
});

describe('useBookList — 도는 쓰기 뒤에 읽는다(코덱스 2R)', () => {
  it('다 만든 표시를 누르자마자 다른 목록을 열면 저장이 끝난 뒤에 읽는다', async () => {
    m.fetchBooks.mockReset();
    m.updateBook.mockReset();
    m.fetchBooks.mockResolvedValue([row('a')]);
    let release!: () => void;
    m.updateBook.mockReturnValueOnce(new Promise((r) => { release = () => r(row('a')); }));
    const making = renderHook(() => useBookList(true, { finished: false }));
    await waitFor(() => expect(making.result.current.books).toHaveLength(1));
    let marking: Promise<void> = Promise.resolve();
    act(() => { marking = making.result.current.setFinished(making.result.current.books[0], true); });
    making.unmount();

    m.fetchBooks.mockResolvedValue([row('a', { finishedAt: '2026-10-26T00:00:00Z' })]);
    const done = renderHook(() => useBookList(true, { finished: true }));
    await act(async () => { await Promise.resolve(); });
    expect(m.fetchBooks).toHaveBeenCalledTimes(1);
    await act(async () => { release(); await marking; });
    await waitFor(() => expect(done.result.current.books.map((b) => b.id)).toEqual(['a']));
    expect(m.fetchBooks).toHaveBeenCalledTimes(2);
  });
});
