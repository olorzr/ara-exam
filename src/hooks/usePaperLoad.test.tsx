import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const paperRow = {
  id: 'p1', title: '문제지', user_id: 'u1', settings: {}, created_at: '2026-10-25T00:00:00Z', updated_at: '2026-11-12T00:00:00Z',
};
let paperResult: { data: unknown; error: unknown } = { data: paperRow, error: null };
/** 문제지 행 읽기마다 차례로 돌려줄 값 — 비면 paperResult */
let paperQueue: { data: unknown; error: unknown }[] = [];
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
        maybeSingle: () => Promise.resolve(table === 'problem_papers' ? (paperQueue.shift() ?? paperResult) : itemResult),
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
    paperQueue = [];
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

  it('항목을 읽는 사이 문제지가 고쳐졌으면 다시 읽어 같은 판으로 연다(섞인 문제지를 인쇄하지 않는다)', async () => {
    fetchCreatorNames.mockResolvedValue(new Map());
    const v2 = { ...paperRow, title: '고친 문제지', updated_at: '2026-11-12T01:00:00Z' };
    paperQueue = [
      { data: paperRow, error: null }, { data: { updated_at: v2.updated_at }, error: null }, // 1차: 판이 바뀜
      { data: v2, error: null }, { data: { updated_at: v2.updated_at }, error: null }, // 2차: 같음
    ];
    const { result } = renderHook(() => usePaperLoad('p1'));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.paper?.title).toBe('고친 문제지');
  });
});

