import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { SourceSetKey } from '@/lib/problem-bank/source-sets';

const fetchSetSources = vi.fn();
vi.mock('@/lib/problem-bank/source-set-queries', () => ({ fetchSetSources: (set: SourceSetKey) => fetchSetSources(set) }));

const { useSetSources } = await import('./useSetSources');

/** 손으로 풀어 주는 약속 */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

const A: SourceSetKey = {
  source_type: '내신기출', year: '2026', grade: '중2', semester: '1학기', exam_type: '중간', textbook: '', publisher: '',
};
const B: SourceSetKey = { ...A, exam_type: '기말' };

describe('useSetSources', () => {
  it('렌더마다 새 객체를 넘겨도 같은 세트면 다시 읽지 않는다', async () => {
    fetchSetSources.mockReset().mockResolvedValue([{ id: 's1' }]);
    const hook = renderHook(() => useSetSources({ ...A }));
    await waitFor(() => expect(hook.result.current.rows).toHaveLength(1));
    hook.rerender();
    hook.rerender();
    expect(fetchSetSources).toHaveBeenCalledTimes(1);
  });

  it('세트가 바뀌면 앞 세트의 학교를 보여 주지 않고, 늦게 온 앞 응답은 버린다', async () => {
    const first = deferred<unknown[]>();
    const second = deferred<unknown[]>();
    fetchSetSources.mockReset().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const hook = renderHook(({ set }) => useSetSources(set), { initialProps: { set: A } });
    hook.rerender({ set: B });
    second.resolve([{ id: 'b1' }]);
    await waitFor(() => expect(hook.result.current.rows).toEqual([{ id: 'b1' }]));
    first.resolve([{ id: 'a1' }]);
    await new Promise((r) => setTimeout(r, 0));
    expect(hook.result.current.rows).toEqual([{ id: 'b1' }]);
  });

  it('세트가 없으면 읽지 않는다', () => {
    fetchSetSources.mockReset();
    const hook = renderHook(() => useSetSources(null));
    expect(hook.result.current.loading).toBe(false);
    expect(fetchSetSources).not.toHaveBeenCalled();
  });
});
