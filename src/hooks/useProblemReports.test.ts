import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProblemReport } from '@/lib/problem-report/types';

const m = vi.hoisted(() => ({
  lists: {} as Record<string, unknown[]>,
  failNext: false,
  resolveGate: null as null | (() => void),
  /** 처리가 커밋되는 순간 목록이 바뀐다 */
  afterResolve: null as null | (() => void),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/problem-report/queries', () => ({
  fetchProblemReports: async (tab: string) => {
    if (m.failNext) { m.failNext = false; throw new Error('읽기 실패'); }
    return [...(m.lists[tab] ?? [])];
  },
  fetchProblemSourceIds: async () => new Map(),
  resolveProblemReport: () => new Promise<void>((done) => {
    m.resolveGate = () => { m.afterResolve?.(); done(); };
  }),
}));

const { useProblemReports } = await import('./useProblemReports');

const report = (id: string) => ({ id, problem_id: null }) as unknown as ProblemReport;
const ids = (rows: ProblemReport[]) => rows.map((r) => r.id);

beforeEach(() => {
  m.lists = { open: [report('a'), report('b')], closed: [report('c')] };
  m.failNext = false;
  m.resolveGate = null;
  m.afterResolve = () => { m.lists = { open: [report('b')], closed: [report('a'), report('c')] }; };
});

async function resolveA(result: { current: ReturnType<typeof useProblemReports> }, beforeCommit?: () => Promise<void>) {
  let done: Promise<void> = Promise.resolve();
  act(() => { done = result.current.resolve(report('a'), 'fixed'); });
  await beforeCommit?.();
  await act(async () => { m.resolveGate?.(); await done; });
}

describe('useProblemReports', () => {
  it('처리하면 그 줄은 이 탭에서 빠지고, 다시 읽어도 그대로다', async () => {
    const { result } = renderHook(() => useProblemReports('open'));
    await waitFor(() => expect(ids(result.current.reports)).toEqual(['a', 'b']));
    await resolveA(result);
    expect(ids(result.current.reports)).toEqual(['b']);
    expect(result.current.loading).toBe(false);
    await waitFor(() => expect(ids(result.current.reports)).toEqual(['b']));
  });

  it('응답 전에 탭을 바꾸면 새 탭의 처리 전 목록을 처리 뒤에 다시 읽는다(코덱스 2R)', async () => {
    const { result, rerender } = renderHook(({ tab }) => useProblemReports(tab), { initialProps: { tab: 'open' as 'open' | 'closed' } });
    await waitFor(() => expect(ids(result.current.reports)).toEqual(['a', 'b']));
    await resolveA(result, async () => {
      rerender({ tab: 'closed' });
      // 처리가 커밋되기 전에 읽은 '처리됨' 목록 — 방금 처리한 a 가 없다
      await waitFor(() => expect(ids(result.current.reports)).toEqual(['c']));
    });
    await waitFor(() => expect(ids(result.current.reports)).toEqual(['a', 'c']));
  });

  it('다시 읽기가 실패해도 보던 목록을 지킨다', async () => {
    const { result } = renderHook(() => useProblemReports('open'));
    await waitFor(() => expect(ids(result.current.reports)).toEqual(['a', 'b']));
    m.failNext = true;
    act(() => result.current.reload());
    await waitFor(() => expect(m.failNext).toBe(false));
    expect(ids(result.current.reports)).toEqual(['a', 'b']);
    expect(result.current.loading).toBe(false);
  });
});
