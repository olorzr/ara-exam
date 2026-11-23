import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ fetch: vi.fn<(id: string) => Promise<unknown>>() }));
vi.mock('@/lib/problem-report/queries', () => ({ fetchReportState: m.fetch }));

const { useReportState } = await import('./useReportState');

const stateOf = (token: string) => ({ tags: { work_titles: [], unit_path: [], area_path: [], grammar_paths: [] }, source: null, token });

beforeEach(() => {
  m.fetch.mockReset();
});

describe('useReportState', () => {
  it('태그·출처 종류를 골랐을 때만 읽는다', async () => {
    m.fetch.mockResolvedValue(stateOf('a'));
    const { result, rerender } = renderHook(({ on }) => useReportState('p1', on), { initialProps: { on: false } });
    expect(result.current.loading).toBe(false);
    expect(m.fetch).not.toHaveBeenCalled();
    rerender({ on: true });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.state?.token).toBe('a'));
  });

  it('문항을 바꾸면 옛 문항의 상태를 내주지 않는다(늦게 온 옛 응답도 버린다)', async () => {
    let releaseOld: (v: unknown) => void = () => undefined;
    m.fetch.mockImplementationOnce(() => new Promise((r) => { releaseOld = r; }));
    m.fetch.mockResolvedValueOnce(stateOf('new'));
    const { result, rerender } = renderHook(({ id }) => useReportState(id, true), { initialProps: { id: 'p1' } });
    rerender({ id: 'p2' });
    await waitFor(() => expect(result.current.state?.token).toBe('new'));
    act(() => releaseOld(stateOf('old')));
    expect(result.current.state?.token).toBe('new');
  });

  it('실패를 알리고, 다시 읽으면 새 값', async () => {
    m.fetch.mockRejectedValueOnce(new Error('x'));
    m.fetch.mockResolvedValueOnce(stateOf('b'));
    const { result } = renderHook(() => useReportState('p1', true));
    await waitFor(() => expect(result.current.failed).toBe(true));
    act(() => result.current.reload());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.state?.token).toBe('b'));
  });

  it('문항이 없으면(원본이 지워진 항목) 읽지 않는다', () => {
    const { result } = renderHook(() => useReportState(null, true));
    expect(result.current).toMatchObject({ state: null, loading: false, failed: false });
    expect(m.fetch).not.toHaveBeenCalled();
  });
});
