import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ fetch: vi.fn<(subject: unknown) => Promise<unknown>>() }));
vi.mock('@/lib/problem-report/queries', () => ({ fetchReportState: m.fetch }));

const { useReportState } = await import('./useReportState');

const stateOf = (token: string) => ({ tags: { work_titles: [], unit_path: [], area_path: [], grammar_paths: [] }, source: null, number: 1, token });
const P1 = { problemId: 'p1' };
const P2 = { problemId: 'p2' };

beforeEach(() => {
  m.fetch.mockReset();
});

describe('useReportState', () => {
  it('태그·출처 종류를 골랐을 때만 읽는다', async () => {
    m.fetch.mockResolvedValue(stateOf('a'));
    const { result, rerender } = renderHook(({ on }) => useReportState(P1, on), { initialProps: { on: false } });
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
    const { result, rerender } = renderHook(({ subject }) => useReportState(subject, true), { initialProps: { subject: P1 } });
    rerender({ subject: P2 });
    await waitFor(() => expect(result.current.state?.token).toBe('new'));
    act(() => releaseOld(stateOf('old')));
    expect(result.current.state?.token).toBe('new');
  });

  it('실패를 알리고, 다시 읽으면 새 값', async () => {
    m.fetch.mockRejectedValueOnce(new Error('x'));
    m.fetch.mockResolvedValueOnce(stateOf('b'));
    const { result } = renderHook(() => useReportState(P1, true));
    await waitFor(() => expect(result.current.failed).toBe(true));
    act(() => result.current.reload());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.state?.token).toBe('b'));
  });

  it('끄고 다시 켜면 새 요청 — 끝날 때까지 옛 실패를 내주지 않는다', async () => {
    m.fetch.mockRejectedValueOnce(new Error('x'));
    let release: (v: unknown) => void = () => undefined;
    m.fetch.mockImplementationOnce(() => new Promise((r) => { release = r; }));
    const { result, rerender } = renderHook(({ on }) => useReportState(P1, on), { initialProps: { on: true } });
    await waitFor(() => expect(result.current.failed).toBe(true));
    rerender({ on: false });
    rerender({ on: true });
    expect(result.current).toMatchObject({ loading: true, failed: false });
    act(() => release(stateOf('c')));
    await waitFor(() => expect(result.current.state?.token).toBe('c'));
  });

  it('A → B → A 로 돌아오면 새 요청 — A 의 옛 실패를 내주지 않는다', async () => {
    m.fetch.mockRejectedValueOnce(new Error('A 실패'));
    m.fetch.mockImplementationOnce(() => new Promise(() => undefined));
    let release: (v: unknown) => void = () => undefined;
    m.fetch.mockImplementationOnce(() => new Promise((r) => { release = r; }));
    const A = { paperItemId: 'a' };
    const B = { paperItemId: 'b' };
    const { result, rerender } = renderHook(({ subject }) => useReportState(subject, true), { initialProps: { subject: A } });
    await waitFor(() => expect(result.current.failed).toBe(true));
    rerender({ subject: B });
    rerender({ subject: A });
    expect(result.current).toMatchObject({ loading: true, failed: false });
    act(() => release(stateOf('a2')));
    await waitFor(() => expect(result.current.state?.token).toBe('a2'));
  });

  it('문제지 항목은 항목으로 읽는다', async () => {
    m.fetch.mockResolvedValue(stateOf('i'));
    const { result } = renderHook(() => useReportState({ paperItemId: 'i1' }, true));
    await waitFor(() => expect(result.current.state?.token).toBe('i'));
    expect(m.fetch).toHaveBeenCalledWith({ paperItemId: 'i1' });
  });

  it('대상이 없으면 읽지 않는다', () => {
    const { result } = renderHook(() => useReportState(null, true));
    expect(result.current).toMatchObject({ state: null, loading: false, failed: false });
    expect(m.fetch).not.toHaveBeenCalled();
  });
});
