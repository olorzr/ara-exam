import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const m = vi.hoisted(() => ({
  searchPapers: vi.fn<(...args: unknown[]) => Promise<unknown[]>>(async () => []),
}));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: { id: 'u1', email: 't@araeducation.co.kr' } }) }));
vi.mock('@/lib/problem-paper/paper-search', async (orig) => ({
  ...(await orig<typeof import('@/lib/problem-paper/paper-search')>()),
  searchPapers: m.searchPapers,
}));

const { usePaperTabCount } = await import('./usePaperTabCount');

beforeEach(() => {
  m.searchPapers.mockReset();
  m.searchPapers.mockImplementation(async () => [{ id: 'a' }, { id: 'b' }]);
});

describe('usePaperTabCount', () => {
  it('찾는 말이 비면 묻지 않고 숫자도 없다', () => {
    const { result } = renderHook(() => usePaperTabCount('others', ''));
    expect(result.current.count).toBeNull();
    expect(m.searchPapers).not.toHaveBeenCalled();
  });

  it('찾는 동안 그 탭에서 찾은 개수를 낸다', async () => {
    const { result } = renderHook(() => usePaperTabCount('others', '음운'));
    await waitFor(() => expect(result.current.count).toBe(2));
    expect(m.searchPapers).toHaveBeenCalledWith('others', 'u1', '음운');
  });

  it('실패하면 숫자를 안 보인다', async () => {
    m.searchPapers.mockImplementation(async () => { throw new Error('x'); });
    const { result } = renderHook(() => usePaperTabCount('others', '음운'));
    await waitFor(() => expect(m.searchPapers).toHaveBeenCalled());
    expect(result.current.count).toBeNull();
  });

  it('늦게 온 옛 응답은 버린다', async () => {
    let releaseOld: (v: unknown[]) => void = () => {};
    m.searchPapers.mockImplementation((_s: unknown, _u: unknown, k: unknown) => (k === '옛'
      ? new Promise<unknown[]>((r) => { releaseOld = r; })
      : Promise.resolve([{ id: 'x' }])));
    const { result, rerender } = renderHook(({ k }) => usePaperTabCount('others', k), { initialProps: { k: '옛' } });
    rerender({ k: '새' });
    await waitFor(() => expect(result.current.count).toBe(1));
    await act(async () => { releaseOld([{ id: 'a' }, { id: 'b' }, { id: 'c' }]); });
    expect(result.current.count).toBe(1);
  });
});
