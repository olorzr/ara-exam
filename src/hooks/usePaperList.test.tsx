import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ProblemPaper } from '@/types/problem-bank';

const m = vi.hoisted(() => ({
  user: { id: 'u1', email: 't@araeducation.co.kr' } as { id: string; email: string } | null,
  deletePaper: vi.fn(async () => {}),
  fetchPapers: vi.fn<(...args: unknown[]) => Promise<unknown[]>>(async () => []),
}));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: m.user }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/problem-paper/paper-list', async (orig) => ({
  ...(await orig<typeof import('@/lib/problem-paper/paper-list')>()),
  fetchPapers: m.fetchPapers,
  deletePaper: m.deletePaper,
}));

const mine = { id: 'p1', title: '내 것', user_id: 'u1' } as ProblemPaper;
const theirs = { id: 'p2', title: '남의 것', user_id: 'u2' } as ProblemPaper;

const { usePaperList } = await import('./usePaperList');

beforeEach(() => {
  m.user = { id: 'u1', email: 't@araeducation.co.kr' };
  m.deletePaper.mockClear();
  m.fetchPapers.mockReset();
  m.fetchPapers.mockImplementation(async () => [mine, theirs]);
});

describe('usePaperList — 지우기는 만든 선생님과 원장만(sql/104)', () => {
  it('남의 문제지는 지울 수 없다고 답하고, remove 도 묻지 않고 막는다', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { result } = renderHook(() => usePaperList('others'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canDelete(mine)).toBe(true);
    expect(result.current.canDelete(theirs)).toBe(false);
    await act(async () => { await result.current.remove(theirs); });
    expect(confirm).not.toHaveBeenCalled();
    expect(m.deletePaper).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('원장은 남의 문제지도 지운다', async () => {
    m.user = { id: 'u9', email: 'ara0723@araeducation.co.kr' };
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { result } = renderHook(() => usePaperList('others'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.remove(theirs); });
    expect(m.deletePaper).toHaveBeenCalledWith('p2');
    expect(result.current.papers.map((p) => p.id)).toEqual(['p1']);
    confirm.mockRestore();
  });
});

describe('usePaperList — 찾기(2026-11-22)', () => {
  it('찾는 말을 넘기고, 바꾸면 다시 읽는 동안 로딩이다', async () => {
    const { result, rerender } = renderHook(({ k }) => usePaperList('mine', k), { initialProps: { k: '' } });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(m.fetchPapers).toHaveBeenLastCalledWith('mine', 'u1', '');
    rerender({ k: '음운' });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(m.fetchPapers).toHaveBeenLastCalledWith('mine', 'u1', '음운');
  });

  it('늦게 온 옛 검색의 응답은 새 목록을 덮지 않는다', async () => {
    let releaseOld: (v: unknown[]) => void = () => {};
    m.fetchPapers.mockImplementation((_s: unknown, _u: unknown, k: unknown) => (k === '옛'
      ? new Promise<unknown[]>((r) => { releaseOld = r; })
      : Promise.resolve([theirs])));
    const { result, rerender } = renderHook(({ k }) => usePaperList('mine', k), { initialProps: { k: '옛' } });
    rerender({ k: '새' });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { releaseOld([mine]); });
    expect(result.current.papers.map((p) => p.id)).toEqual(['p2']);
  });

  it('상한(200개)에 닿으면 capped', async () => {
    m.fetchPapers.mockImplementation(async () => Array.from({ length: 200 }, (_, i) => ({ ...mine, id: `p${i}` })));
    const { result } = renderHook(() => usePaperList('mine', ''));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.capped).toBe(true);
  });
});
