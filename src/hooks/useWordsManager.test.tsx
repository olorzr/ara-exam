import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { Category, Word } from '@/types';

/**
 * 단어 관리 — 카테고리를 빠르게 바꾸는 사이의 쓰기 (2026-10-15 리뷰 1번).
 *
 * 목록 조회는 카테고리마다 손으로 풀 수 있는 약속이고, 쓰기 함수는 받은 인자만 적어 둔다.
 * **고른 카테고리 밖의 행은 어떤 쓰기의 대상도 되지 않아야 한다.**
 */

const m = vi.hoisted(() => ({
  fetches: [] as { categoryId: string; resolve: (w: unknown) => void; reject: (e: unknown) => void }[],
  deleteWords: vi.fn(),
  moveWords: vi.fn(),
  updateWord: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => {
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.order = () => q;
      q.then = (yes: (r: unknown) => unknown) => Promise.resolve({ data: [] }).then(yes);
      return q;
    },
  },
}));
vi.mock('@/lib/auth-context', () => {
  const user = { id: 'user' };
  return { useAuth: () => ({ user }) };
});
vi.mock('sonner', () => ({ toast: m.toast }));
vi.mock('@/lib/words-mutations', () => ({
  fetchCategoryWords: (categoryId: string) => new Promise((resolve, reject) => {
    m.fetches.push({ categoryId, resolve, reject });
  }),
  deleteWordsInCategory: (...a: unknown[]) => m.deleteWords(...a),
  moveWordsInCategory: (...a: unknown[]) => m.moveWords(...a),
  updateWordInCategory: (...a: unknown[]) => m.updateWord(...a),
}));

const { useWordsManager } = await import('./useWordsManager');

const cat = (id: string) => ({ id, level: '중등', grade: '중2', publisher: '합성', chapter: id }) as Category;
const word = (id: string, categoryId: string) => ({
  id, word: id, meaning: `${id} 뜻`, category_id: categoryId, order_index: 0, created_at: '', updated_at: '',
}) as Word;

/** n 번째 조회를 푼다 (0부터) */
async function resolveFetch(n: number, words: Word[]) {
  await act(async () => { m.fetches[n].resolve(words); });
}
async function rejectFetch(n: number) {
  await act(async () => { m.fetches[n].reject(new Error('network')); });
}

beforeEach(() => {
  m.fetches = [];
  m.deleteWords.mockReset().mockImplementation(async (_c: string, ids: string[]) => ids);
  m.moveWords.mockReset().mockImplementation(async (_c: string, ids: string[]) => ids);
  m.updateWord.mockReset().mockResolvedValue(true);
  Object.values(m.toast).forEach((t) => t.mockReset());
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

async function mounted() {
  const hook = renderHook(() => useWordsManager());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

describe('useWordsManager — 응답 순서', () => {
  it('⚠️ A 를 읽는 사이 B 를 고르면 늦게 온 A 응답은 버리고, 삭제는 B 의 단어만 한다', async () => {
    const { result } = await mounted();
    act(() => result.current.handleSelectCategory(cat('A')));
    act(() => result.current.handleSelectCategory(cat('B')));
    await resolveFetch(1, [word('b-word', 'B')]);
    await resolveFetch(0, [word('a-word', 'A')]);

    expect(result.current.selectedCategory?.id).toBe('B');
    expect(result.current.words.map((w) => w.id)).toEqual(['b-word']);

    act(() => result.current.setSelectMode(true));
    act(() => result.current.toggleSelectAll());
    await act(async () => { await result.current.handleBulkDelete(); });
    expect(m.deleteWords).toHaveBeenCalledWith('B', ['b-word']);
  });

  it('A → B → A 면 마지막 A 응답만 반영한다', async () => {
    const { result } = await mounted();
    act(() => result.current.handleSelectCategory(cat('A')));
    act(() => result.current.handleSelectCategory(cat('B')));
    act(() => result.current.handleSelectCategory(cat('A')));

    await resolveFetch(2, [word('a-new', 'A')]);
    await resolveFetch(1, [word('b-word', 'B')]);
    await resolveFetch(0, [word('a-old', 'A')]);
    expect(result.current.words.map((w) => w.id)).toEqual(['a-new']);
  });

  it('⚠️ 늦게 온 옛 실패가 최신 목록을 비우거나 실패로 덮지 않는다', async () => {
    const { result } = await mounted();
    act(() => result.current.handleSelectCategory(cat('A')));
    act(() => result.current.handleSelectCategory(cat('B')));
    await resolveFetch(1, [word('b-word', 'B')]);
    await rejectFetch(0);

    expect(result.current.wordsFailed).toBe(false);
    expect(result.current.words.map((w) => w.id)).toEqual(['b-word']);
    expect(m.toast.error).not.toHaveBeenCalled();
  });
});

describe('useWordsManager — 같은 카테고리로 돌아왔을 때 (코덱스 1R)', () => {
  it('⚠️ A → B → A 로 돌아오면 다시 읽기가 끝날 때까지 옛 A 목록을 쓰지 않고, 실패하면 실패다', async () => {
    const { result } = await mounted();
    act(() => result.current.handleSelectCategory(cat('A')));
    await resolveFetch(0, [word('a-word', 'A')]);
    act(() => result.current.handleSelectCategory(cat('B')));
    act(() => result.current.handleSelectCategory(cat('A')));

    expect(result.current.wordsLoading).toBe(true);
    expect(result.current.words).toEqual([]);
    await rejectFetch(2);
    expect(result.current.wordsFailed).toBe(true);
    expect(result.current.words).toEqual([]);
  });

  it('⚠️ A 에서 시작한 쓰기가 B 로 옮긴 뒤 0행으로 끝나도 B 화면을 멈춰 세우지 않는다', async () => {
    const { result } = await mounted();
    act(() => result.current.handleSelectCategory(cat('A')));
    await resolveFetch(0, [word('a-word', 'A')]);

    let finishDelete!: (ids: string[]) => void;
    m.deleteWords.mockReturnValueOnce(new Promise<string[]>((res) => { finishDelete = res; }));
    let job!: Promise<void>;
    act(() => { job = result.current.handleDeleteWord('a-word'); });
    act(() => result.current.handleSelectCategory(cat('B')));
    await act(async () => { finishDelete([]); await job; });

    // A 를 다시 읽지 않는다 — 조회는 A(처음)·B 둘뿐이다
    expect(m.fetches.map((f) => f.categoryId)).toEqual(['A', 'B']);
    await resolveFetch(1, [word('b-word', 'B')]);
    expect(result.current.wordsLoading).toBe(false);
    expect(result.current.words.map((w) => w.id)).toEqual(['b-word']);
  });

  it('A 의 일괄 삭제가 B 로 옮긴 뒤 끝나도 B 의 선택을 지우지 않는다', async () => {
    const { result } = await mounted();
    act(() => result.current.handleSelectCategory(cat('A')));
    await resolveFetch(0, [word('a1', 'A')]);
    act(() => result.current.setSelectMode(true));
    act(() => result.current.toggleSelectAll());

    let finishDelete!: (ids: string[]) => void;
    m.deleteWords.mockReturnValueOnce(new Promise<string[]>((res) => { finishDelete = res; }));
    let job!: Promise<void>;
    act(() => { job = result.current.handleBulkDelete(); });
    act(() => result.current.handleSelectCategory(cat('B')));
    await resolveFetch(1, [word('b1', 'B')]);
    act(() => result.current.setSelectMode(true));
    act(() => result.current.toggleWordSelect('b1'));

    await act(async () => { finishDelete(['a1']); await job; });
    expect(result.current.selectMode).toBe(true);
    expect([...result.current.selectedWordIds]).toEqual(['b1']);
  });
});

describe('useWordsManager — 목록을 바꾸는 중의 쓰기', () => {
  /** A 를 다 읽고 전부 고른 뒤 B 로 옮기는 중(아직 안 옴)인 훅 */
  async function switching() {
    const hook = await mounted();
    const { result } = hook;
    act(() => result.current.handleSelectCategory(cat('A')));
    await resolveFetch(0, [word('a-word', 'A'), word('a-word-2', 'A')]);
    act(() => result.current.setSelectMode(true));
    act(() => result.current.toggleSelectAll());
    act(() => result.current.handleSelectCategory(cat('B')));
    return hook;
  }

  it('⚠️ 새 목록이 오기 전에는 옛 목록이 보이지 않고 체크도 비워진다', async () => {
    const { result } = await switching();
    expect(result.current.wordsLoading).toBe(true);
    expect(result.current.words).toEqual([]);
    expect(result.current.selectedWordIds.size).toBe(0);
  });

  it('⚠️ 그 사이 전체 선택·일괄 삭제·이동·단건 삭제는 아무것도 쓰지 않는다', async () => {
    const { result } = await switching();
    act(() => result.current.setSelectMode(true));
    act(() => result.current.toggleSelectAll());
    await act(async () => { await result.current.handleBulkDelete(); });
    await act(async () => { await result.current.handleMoveConfirm(cat('C')); });
    await act(async () => { await result.current.handleDeleteWord('a-word'); });

    expect(m.deleteWords).not.toHaveBeenCalled();
    expect(m.moveWords).not.toHaveBeenCalled();
  });

  it('그 사이 옛 카테고리 단어의 수정 창은 열리지 않는다', async () => {
    const { result } = await switching();
    act(() => result.current.startEdit(word('a-word', 'A')));
    expect(result.current.editWord).toBeNull();
  });

  it('조회가 실패하면 옛 목록 대신 실패를 알리고, 다시 시도로 되살린다', async () => {
    const { result } = await switching();
    await rejectFetch(1);
    expect(result.current.wordsFailed).toBe(true);
    expect(result.current.words).toEqual([]);

    act(() => result.current.reloadWords());
    expect(result.current.wordsLoading).toBe(true);
    await resolveFetch(2, [word('b-word', 'B')]);
    expect(result.current.words.map((w) => w.id)).toEqual(['b-word']);
  });
});

describe('useWordsManager — 영향 행 확인', () => {
  async function loadedB() {
    const hook = await mounted();
    act(() => hook.result.current.handleSelectCategory(cat('B')));
    await resolveFetch(0, [word('b1', 'B'), word('b2', 'B')]);
    return hook;
  }

  it('⚠️ 단건 삭제가 0행이면 성공을 알리지 않고 목록을 다시 읽는다', async () => {
    const { result } = await loadedB();
    m.deleteWords.mockResolvedValueOnce([]);
    await act(async () => { await result.current.handleDeleteWord('b1'); });

    expect(m.deleteWords).toHaveBeenCalledWith('B', ['b1']);
    expect(m.toast.success).not.toHaveBeenCalled();
    expect(m.toast.error).toHaveBeenCalled();
    expect(m.fetches).toHaveLength(2);
  });

  it('일괄 삭제가 일부만 되면 그만큼만 빼고 알린 뒤 다시 읽는다', async () => {
    const { result } = await loadedB();
    m.deleteWords.mockResolvedValueOnce(['b1']);
    act(() => result.current.setSelectMode(true));
    act(() => result.current.toggleSelectAll());
    await act(async () => { await result.current.handleBulkDelete(); });

    expect(m.toast.warning).toHaveBeenCalledWith(expect.stringContaining('2개 중 1개만'));
    expect(m.fetches).toHaveLength(2);
  });

  it('이동은 지금 카테고리에서 고른 카테고리로만 나간다', async () => {
    const { result } = await loadedB();
    act(() => result.current.setSelectMode(true));
    act(() => result.current.toggleWordSelect('b2'));
    await act(async () => { await result.current.handleMoveConfirm(cat('C')); });
    expect(m.moveWords).toHaveBeenCalledWith('B', ['b2'], 'C');
    expect(result.current.words.map((w) => w.id)).toEqual(['b1']);
  });

  it('⚠️ 수정이 0행이면 성공을 알리지 않는다', async () => {
    const { result } = await loadedB();
    m.updateWord.mockResolvedValueOnce(false);
    act(() => result.current.startEdit(word('b1', 'B')));
    act(() => result.current.setEditForm({ word: '고친', meaning: '뜻' }));
    await act(async () => { await result.current.handleEditSave(); });

    expect(m.updateWord).toHaveBeenCalledWith('B', 'b1', { word: '고친', meaning: '뜻' });
    expect(m.toast.success).not.toHaveBeenCalled();
    expect(m.toast.error).toHaveBeenCalled();
  });
});
