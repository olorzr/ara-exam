import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hasWorkInProgress } from '@/lib/work-in-progress';
import type { ProblemSource } from '@/types/problem-bank';
import { useSourceDelete } from './useSourceDelete';

const mocks = vi.hoisted(() => ({ count: vi.fn(), ids: vi.fn(), papers: vi.fn(), remove: vi.fn() }));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: { email: 'ara0723@araeducation.co.kr' } }) }));
vi.mock('@/lib/problem-bank/mutations-source', () => ({ deleteSource: mocks.remove }));
vi.mock('@/lib/problem-bank/mutations', () => ({ countPapersUsing: mocks.papers }));
vi.mock('@/lib/problem-bank/source-list', () => ({
  countSourceProblems: mocks.count, fetchSourceProblemIds: mocks.ids,
}));

const source = { id: 's1', title: '시험지' } as ProblemSource;

beforeEach(() => {
  mocks.count.mockResolvedValue(1);
  mocks.ids.mockResolvedValue(['p1']);
  mocks.papers.mockResolvedValue(0);
  mocks.remove.mockResolvedValue(undefined);
  vi.stubGlobal('confirm', () => true);
});

describe('useSourceDelete', () => {
  it('화면을 떠나도 지우기가 끝날 때까지 자동 새로 고침을 미룬다', async () => {
    let finish: () => void = () => undefined;
    mocks.remove.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    const { result, unmount } = renderHook(() => useSourceDelete(() => undefined));
    expect(hasWorkInProgress()).toBe(false);

    let running: Promise<void> = Promise.resolve();
    await act(async () => {
      running = result.current.requestDelete(source);
      await Promise.resolve();
    });
    expect(hasWorkInProgress()).toBe(true);

    await act(async () => { await vi.waitFor(() => expect(mocks.remove).toHaveBeenCalled()); });
    unmount();
    expect(hasWorkInProgress()).toBe(true);

    await act(async () => {
      finish();
      await running;
    });
    expect(hasWorkInProgress()).toBe(false);
  });
});
