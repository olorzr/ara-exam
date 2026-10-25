import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const paperRow = { id: 'p1', title: '문제지', user_id: 'u1', settings: {}, created_at: '2026-10-25T00:00:00Z' };
let paperResult: { data: unknown; error: unknown } = { data: paperRow, error: null };
const itemResult = { data: [{ order_index: 0, snapshot: { kind: 'x' } }], error: null };
const fetchCreatorNames = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => Promise.resolve(itemResult),
        maybeSingle: () => Promise.resolve(table === 'problem_papers' ? paperResult : itemResult),
      };
      return chain;
    },
  },
}));
vi.mock('@/lib/creator-names', () => ({ fetchCreatorNames: (...a: unknown[]) => fetchCreatorNames(...a) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

import { usePaperLoad } from './usePaperLoad';

describe('usePaperLoad', () => {
  beforeEach(() => {
    paperResult = { data: paperRow, error: null };
    fetchCreatorNames.mockReset();
  });

  it('문제지·항목과 만든 선생님 이름을 함께 읽은 뒤에 loaded 를 켠다', async () => {
    fetchCreatorNames.mockResolvedValue(new Map([['u1', '송알']]));
    const { result } = renderHook(() => usePaperLoad('p1'));
    expect(result.current.loaded).toBe(false);
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.paper?.id).toBe('p1');
    expect(result.current.items).toHaveLength(1);
    expect(result.current.creatorName).toBe('송알');
    expect(fetchCreatorNames).toHaveBeenCalledWith(['u1']);
  });

  it('이름을 못 읽으면 빈 이름으로 그대로 연다', async () => {
    fetchCreatorNames.mockResolvedValue(new Map());
    const { result } = renderHook(() => usePaperLoad('p1'));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.paper).not.toBeNull();
    expect(result.current.creatorName).toBe('');
  });

  it('조회가 실패하면 문제지 없이 loaded', async () => {
    paperResult = { data: null, error: new Error('network') };
    const { result } = renderHook(() => usePaperLoad('p1'));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.paper).toBeNull();
    expect(fetchCreatorNames).not.toHaveBeenCalled();
  });
});
