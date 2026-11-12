import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

let result: { data: unknown; error: unknown } = { data: { updated_at: 'v1' }, error: null };
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => {
      const chain = { select: () => chain, eq: () => chain, maybeSingle: () => Promise.resolve(result) };
      return chain;
    },
  },
}));

const { usePaperRevisionWatch } = await import('./usePaperRevisionWatch');

beforeEach(() => { result = { data: { updated_at: 'v1' }, error: null }; });

describe('usePaperRevisionWatch', () => {
  it('판이 그대로면 바뀐 것이 아니다', async () => {
    const { result: hook } = renderHook(() => usePaperRevisionWatch('p1', 'v1'));
    await act(async () => { await hook.current.check(); });
    expect(hook.current.stale).toBe(false);
  });

  it('창으로 돌아왔을 때 판이 바뀌었으면 알린다', async () => {
    const { result: hook } = renderHook(() => usePaperRevisionWatch('p1', 'v1'));
    result = { data: { updated_at: 'v2' }, error: null };
    await act(async () => { window.dispatchEvent(new Event('focus')); await new Promise((r) => setTimeout(r, 0)); });
    expect(hook.current.stale).toBe(true);
  });

  it('문제지가 지워졌으면 바뀐 것으로, 조회가 실패하면 판단하지 않는다', async () => {
    result = { data: null, error: null };
    const gone = renderHook(() => usePaperRevisionWatch('p1', 'v1'));
    await act(async () => { await gone.result.current.check(); });
    expect(gone.result.current.stale).toBe(true);

    result = { data: null, error: new Error('끊김') };
    const failed = renderHook(() => usePaperRevisionWatch('p1', 'v1'));
    await act(async () => { await failed.result.current.check(); });
    expect(failed.result.current.stale).toBe(false);
  });

  it('새 판을 다시 읽으면(새로 고침) 경고가 풀린다', async () => {
    const { result: hook, rerender } = renderHook(({ rev }) => usePaperRevisionWatch('p1', rev), { initialProps: { rev: 'v1' } });
    result = { data: { updated_at: 'v2' }, error: null };
    await act(async () => { await hook.current.check(); });
    expect(hook.current.stale).toBe(true);
    rerender({ rev: 'v2' });
    expect(hook.current.stale).toBe(false);
  });
});
