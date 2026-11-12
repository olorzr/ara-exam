import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ProblemPaper } from '@/types/problem-bank';

const m = vi.hoisted(() => ({
  user: { id: 'u1', email: 't@araeducation.co.kr' } as { id: string; email: string } | null,
  deletePaper: vi.fn(async () => {}),
}));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: m.user }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/problem-paper/paper-list', async (orig) => ({
  ...(await orig<typeof import('@/lib/problem-paper/paper-list')>()),
  fetchPapers: vi.fn(async () => [mine, theirs]),
  deletePaper: m.deletePaper,
}));

const mine = { id: 'p1', title: '내 것', user_id: 'u1' } as ProblemPaper;
const theirs = { id: 'p2', title: '남의 것', user_id: 'u2' } as ProblemPaper;

const { usePaperList } = await import('./usePaperList');

beforeEach(() => {
  m.user = { id: 'u1', email: 't@araeducation.co.kr' };
  m.deletePaper.mockClear();
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
