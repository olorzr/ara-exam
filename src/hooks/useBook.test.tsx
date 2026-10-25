import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { DEFAULT_BOOK_SETTINGS, type Book } from '@/lib/book';

const m = vi.hoisted(() => ({
  fetchBook: vi.fn(),
  updateBook: vi.fn(),
  updateChapterTitle: vi.fn(),
  reorderChapters: vi.fn(),
}));
vi.mock('@/lib/book', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/book')>()),
  fetchBook: m.fetchBook,
  updateBook: m.updateBook,
  updateChapterTitle: m.updateChapterTitle,
  reorderChapters: m.reorderChapters,
}));
vi.mock('@/lib/creator-names', () => ({ fetchCreatorNames: async () => new Map() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { useBook } = await import('./useBook');

const base: Book = {
  id: 'b1', title: '책', kind: 'book', finishedAt: null, settings: DEFAULT_BOOK_SETTINGS,
  pageCounts: { teacher: { pages: 40, key: 't' } },
  cover: null, userId: 'u', createdAt: '', updatedAt: '',
};

/** 손으로 풀어 주는 약속 */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function loaded() {
  const hook = renderHook(() => useBook('b1', true));
  await waitFor(() => expect(hook.result.current.book).not.toBeNull());
  return hook;
}

describe('useBook — 설정 저장', () => {
  beforeEach(() => {
    m.fetchBook.mockResolvedValue({ book: base, chapters: [] });
    m.updateBook.mockReset();
  });

  it('보내기 전에 화면에 먼저 얹어, 응답 전 다음 변경이 앞의 변경을 되돌리지 않는다', async () => {
    const first = deferred<Book>();
    const second = deferred<Book>();
    m.updateBook.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result } = await loaded();

    await act(async () => { void result.current.save({ settings: { ...result.current.book!.settings, columns: 1 } }); });
    expect(result.current.book!.settings.columns).toBe(1);
    // 다음 변경은 지금 화면 값(앞의 변경이 얹힌)에서 만든다
    await act(async () => { void result.current.save({ settings: { ...result.current.book!.settings, chapterStart: 'page' } }); });
    expect(result.current.book!.settings).toMatchObject({ columns: 1, chapterStart: 'page' });

    // 앞 응답(뒤 변경이 없는 서버 값)은 화면에 받지 않는다 — 뒤 쓰기가 아직 남았다
    await act(async () => { first.resolve({ ...base, settings: { ...base.settings, columns: 1 } }); });
    expect(result.current.book!.settings).toMatchObject({ columns: 1, chapterStart: 'page' });
    await waitFor(() => expect(m.updateBook).toHaveBeenCalledTimes(2));
    expect(m.updateBook.mock.calls[1][1].settings).toMatchObject({ columns: 1, chapterStart: 'page' });
    const both = { ...base, settings: { ...base.settings, columns: 1 as const, chapterStart: 'page' as const } };
    await act(async () => { second.resolve(both); });
    expect(result.current.book!.settings).toMatchObject({ columns: 1, chapterStart: 'page' });
  });

  it('실패하면 마지막으로 서버가 돌려준 책으로 되돌린다', async () => {
    m.updateBook.mockRejectedValueOnce(new Error('네트워크'));
    const { result } = await loaded();
    await act(async () => { await result.current.save({ title: '새 제목' }); });
    expect(result.current.book!.title).toBe('책');
  });

  it('쪽 수 기록은 미리 얹지 않고, 다른 판의 기록은 지금 값에서 합친다', async () => {
    const pending = deferred<Book>();
    m.updateBook.mockReturnValueOnce(pending.promise);
    const { result } = await loaded();
    // 쪽 수 저장은 줄에 서므로 다음 마이크로태스크에 나간다
    await act(async () => { void result.current.savePageCount('student', { pages: 120, key: 's' }); });
    expect(result.current.book!.pageCounts.student).toBeUndefined();
    expect(m.updateBook.mock.calls[0][1]).toEqual({
      page_counts: { teacher: { pages: 40, key: 't' }, student: { pages: 120, key: 's' } },
    });
    await act(async () => {
      pending.resolve({ ...base, pageCounts: { ...base.pageCounts, student: { pages: 120, key: 's' } } });
    });
    expect(result.current.book!.pageCounts.student).toEqual({ pages: 120, key: 's' });
  });
});

describe('useBook — 줄 세우기(코덱스 1R)', () => {
  const chapter = (id: string, i: number) => ({
    id, bookId: 'b1', paperId: `p${i}`, orderIndex: i, titleOverride: '', paper: null,
  });

  beforeEach(() => {
    m.fetchBook.mockResolvedValue({ book: base, chapters: [chapter('c0', 0), chapter('c1', 1)] });
    m.updateBook.mockReset();
    m.updateChapterTitle.mockReset();
    m.reorderChapters.mockReset();
  });

  it('제목을 고치고 곧바로 옮겨도 옮기기가 새 제목으로 장을 쓴다', async () => {
    const rename = deferred<void>();
    m.updateChapterTitle.mockReturnValueOnce(rename.promise);
    m.reorderChapters.mockResolvedValue(undefined);
    const { result } = await loaded();
    act(() => {
      void result.current.renameChapter('c0', '새 장');
      void result.current.moveChapter('c0', 1);
    });
    expect(result.current.chapters[0].titleOverride).toBe('새 장');
    expect(m.reorderChapters).not.toHaveBeenCalled(); // 제목 저장이 끝날 때까지 기다린다
    await act(async () => { rename.resolve(); });
    await waitFor(() => expect(m.reorderChapters).toHaveBeenCalled());
    const rows = m.reorderChapters.mock.calls[0][0] as { id: string; titleOverride: string }[];
    expect(rows.map((c) => [c.id, c.titleOverride])).toEqual([['c1', ''], ['c0', '새 장']]);
  });

  it('두 판의 쪽 수를 겹쳐 저장해도 뒤 저장이 앞 판의 기록을 지우지 않는다', async () => {
    const first = deferred<Book>();
    m.updateBook.mockReturnValueOnce(first.promise).mockImplementationOnce(async (_id: string, patch: { page_counts: unknown }) => ({
      ...base, pageCounts: patch.page_counts,
    }));
    const { result } = await loaded();
    await act(async () => {
      void result.current.savePageCount('student', { pages: 120, key: 's' });
      void result.current.savePageCount('key', { pages: 24, key: 'k' });
    });
    expect(m.updateBook).toHaveBeenCalledTimes(1); // 둘째는 첫째가 끝날 때까지 기다린다
    await act(async () => {
      first.resolve({ ...base, pageCounts: { ...base.pageCounts, student: { pages: 120, key: 's' } } });
    });
    await waitFor(() => expect(m.updateBook).toHaveBeenCalledTimes(2));
    expect(m.updateBook.mock.calls[1][1].page_counts).toEqual({
      teacher: { pages: 40, key: 't' }, student: { pages: 120, key: 's' }, key: { pages: 24, key: 'k' },
    });
  });

  it('제목 저장이 실패하면 화면의 제목을 되돌린다', async () => {
    m.updateChapterTitle.mockRejectedValueOnce(new Error('네트워크'));
    const { result } = await loaded();
    await act(async () => { await result.current.renameChapter('c0', '새 장'); });
    expect(result.current.chapters[0].titleOverride).toBe('');
  });
});

describe('useBook — 쓰기 줄(코덱스 2R)', () => {
  const chapter = (id: string, i: number) => ({
    id, bookId: 'b1', paperId: `p${i}`, orderIndex: i, titleOverride: '', paper: null,
  });

  beforeEach(() => {
    m.fetchBook.mockResolvedValue({ book: base, chapters: [chapter('c0', 0), chapter('c1', 1)] });
    m.updateBook.mockReset();
    m.updateChapterTitle.mockReset();
    m.reorderChapters.mockReset();
  });

  it('설정 저장 둘은 겹쳐 보내지 않는다 — 앞이 끝나야 뒤가 나간다', async () => {
    const first = deferred<Book>();
    m.updateBook.mockReturnValueOnce(first.promise).mockResolvedValueOnce(base);
    const { result } = await loaded();
    // 화면에서는 클릭마다 다시 그려진다 — 두 번의 act 로 흉내 낸다
    await act(async () => { void result.current.save({ settings: { ...result.current.book!.settings, columns: 1 } }); });
    await act(async () => { void result.current.save({ settings: { ...result.current.book!.settings, chapterStart: 'page' } }); });
    expect(m.updateBook).toHaveBeenCalledTimes(1);
    await act(async () => { first.resolve(base); });
    await waitFor(() => expect(m.updateBook).toHaveBeenCalledTimes(2));
    expect(m.updateBook.mock.calls[1][1].settings).toMatchObject({ columns: 1, chapterStart: 'page' });
  });

  it('옮기는 중에 고친 장 제목을 옮기기 결과가 덮지 않는다', async () => {
    const reorder = deferred<void>();
    m.reorderChapters.mockReturnValueOnce(reorder.promise);
    m.updateChapterTitle.mockResolvedValue(undefined);
    const { result } = await loaded();
    await act(async () => { void result.current.moveChapter('c0', 1); });
    act(() => { void result.current.renameChapter('c0', '고친 제목'); });
    await act(async () => { reorder.resolve(); });
    await waitFor(() => expect(m.updateChapterTitle).toHaveBeenCalled());
    expect(result.current.chapters.map((c) => [c.id, c.titleOverride])).toEqual([['c1', ''], ['c0', '고친 제목']]);
  });
});

describe('useBook — 실패 되돌리기(코덱스 3R)', () => {
  const chapter = (id: string, i: number, titleOverride = '') => ({
    id, bookId: 'b1', paperId: `p${i}`, orderIndex: i, titleOverride, paper: null,
  });

  beforeEach(() => {
    m.fetchBook.mockResolvedValue({ book: base, chapters: [chapter('c0', 0, '저장된 제목')] });
    m.updateBook.mockReset();
    m.updateChapterTitle.mockReset();
  });

  it('설정 저장 뒤 쪽 수 저장이 줄에 섰다가 둘 다 실패하면 저장된 설정으로 돌아간다', async () => {
    const first = deferred<Book>();
    m.updateBook.mockReturnValueOnce(first.promise).mockRejectedValueOnce(new Error('네트워크'));
    const { result } = await loaded();
    await act(async () => { void result.current.save({ settings: { ...result.current.book!.settings, columns: 1 } }); });
    expect(result.current.book!.settings.columns).toBe(1);
    let pageSaved: Promise<boolean> = Promise.resolve(true);
    await act(async () => { pageSaved = result.current.savePageCount('student', { pages: 8, key: 's' }); });
    await act(async () => { first.reject(new Error('네트워크')); await pageSaved; });
    expect(m.updateBook).toHaveBeenCalledTimes(2);
    expect(result.current.book!.settings.columns).toBe(2);
  });

  it('제목을 두 번 고쳐 둘 다 실패하면 DB 에 있는 제목으로 돌아간다', async () => {
    m.updateChapterTitle.mockRejectedValue(new Error('네트워크'));
    const { result } = await loaded();
    await act(async () => {
      void result.current.renameChapter('c0', '첫 시도');
    });
    await act(async () => {
      await result.current.renameChapter('c0', '둘째 시도');
    });
    expect(result.current.chapters[0].titleOverride).toBe('저장된 제목');
  });
});

describe('useBook — 다 만든 표시', () => {
  beforeEach(() => {
    m.fetchBook.mockResolvedValue({ book: base, chapters: [] });
    m.updateBook.mockReset();
  });

  it('누르면 화면에 먼저 얹고 시각을 보내며, 서버 값을 받는다', async () => {
    const pending = deferred<Book>();
    m.updateBook.mockReturnValueOnce(pending.promise);
    const { result } = await loaded();
    await act(async () => { void result.current.setFinished(true); });
    expect(result.current.book!.finishedAt).not.toBeNull();
    await waitFor(() => expect(m.updateBook).toHaveBeenCalledTimes(1));
    expect(m.updateBook.mock.calls[0][1]).toEqual({ finished_at: expect.any(String) });
    await act(async () => { pending.resolve({ ...base, finishedAt: '2026-10-26T01:00:00Z' }); });
    expect(result.current.book!.finishedAt).toBe('2026-10-26T01:00:00Z');
  });

  it('실패하면 만드는 중으로 되돌리고, 다시 작업은 null 을 보낸다', async () => {
    m.updateBook.mockRejectedValueOnce(new Error('네트워크'));
    const { result } = await loaded();
    await act(async () => { await result.current.setFinished(true); });
    expect(result.current.book!.finishedAt).toBeNull();

    m.updateBook.mockResolvedValueOnce(base);
    await act(async () => { await result.current.setFinished(false); });
    expect(m.updateBook.mock.calls.at(-1)![1]).toEqual({ finished_at: null });
  });
});

describe('useBook — 화면을 옮겨도 쓰기가 이어진다(코덱스 1R)', () => {
  beforeEach(() => {
    m.fetchBook.mockReset();
    m.updateBook.mockReset();
  });

  it('저장이 도는 사이 다른 화면이 같은 책을 열면 저장이 끝난 뒤에 읽는다', async () => {
    m.fetchBook.mockResolvedValue({ book: base, chapters: [] });
    const pending = deferred<Book>();
    m.updateBook.mockReturnValueOnce(pending.promise);
    const first = await loaded();
    await act(async () => { void first.result.current.save({ settings: { ...base.settings, columns: 1 } }); });
    first.unmount();

    // 새 화면(표지 만들기 ↔ 내지 만들기) — 저장이 끝나기 전에는 책을 읽지 않는다
    const saved = { ...base, settings: { ...base.settings, columns: 1 as const } };
    m.fetchBook.mockResolvedValue({ book: saved, chapters: [] });
    const second = renderHook(() => useBook('b1', true));
    await act(async () => { await Promise.resolve(); });
    expect(m.fetchBook).toHaveBeenCalledTimes(1);
    expect(second.result.current.loaded).toBe(false);

    await act(async () => { pending.resolve(saved); });
    await waitFor(() => expect(second.result.current.book?.settings.columns).toBe(1));
    expect(m.fetchBook).toHaveBeenCalledTimes(2);
  });
});
