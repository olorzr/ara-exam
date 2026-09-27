import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { EMPTY_FILTERS } from '@/lib/problem-bank/filters';
import type { TypeMixRow } from '@/lib/problem-paper/type-mix';
import type { ArchiveRow } from './useProblemArchive';

const fetchTypeMixPool = vi.fn();
const fetchProblemsByIdsForAdd = vi.fn();
const toastError = vi.fn();

vi.mock('@/lib/problem-bank/type-mix-queries', () => ({
  fetchTypeMixPool: (...args: unknown[]) => fetchTypeMixPool(...args),
  fetchProblemsByIdsForAdd: (...args: unknown[]) => fetchProblemsByIdsForAdd(...args),
}));
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: vi.fn(),
  },
}));

const { usePaperTypeMix } = await import('./usePaperTypeMix');

/** 손으로 풀 수 있는 약속 — 응답 시점을 시험이 정한다 */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

const poolRow = (id: string): TypeMixRow =>
  ({ id, question_type: '객관식', passage_id: null });

/** 훅에 넘길 세 짝 — 조건 세대와 잠금을 시험이 쥔다 */
function harness() {
  let seq = 0;
  const addRows = vi.fn(() => true);
  const bulk = {
    addRows,
    filterSeq: () => seq,
    lock: { acquire: () => true, release: vi.fn() },
  };
  const paper = { added: new Set<string>(), clearSeq: () => 0 };
  const archive = { filters: EMPTY_FILTERS, total: 10 };
  return { archive, paper, bulk, addRows, bumpFilter: () => { seq += 1; } };
}

beforeEach(() => {
  fetchTypeMixPool.mockReset();
  fetchProblemsByIdsForAdd.mockReset();
  toastError.mockReset();
});

describe('usePaperTypeMix', () => {
  it('창을 열면 풀을 읽어 둔다', async () => {
    fetchTypeMixPool.mockResolvedValue({ rows: [poolRow('a'), poolRow('b')], total: 2 });
    const h = harness();
    const { result } = renderHook(() => usePaperTypeMix(h.archive, h.paper, h.bulk));

    act(() => { result.current.openDialog(); });

    expect(result.current.open).toBe(true);
    await waitFor(() => expect(result.current.pool).toHaveLength(2));
  });

  /** 조용히 잘린 목록을 '전부' 로 보고 뽑으면 안 된다 */
  it('조건에 너무 많이 걸리면 창을 열지 않는다', () => {
    const h = harness();
    const { result } = renderHook(
      () => usePaperTypeMix({ ...h.archive, total: 5000 }, h.paper, h.bulk),
    );

    act(() => { result.current.openDialog(); });

    expect(result.current.open).toBe(false);
    expect(fetchTypeMixPool).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalled();
  });

  it('받아 오는 사이 문항이 늘어 상한을 넘으면 오류로 알린다', async () => {
    fetchTypeMixPool.mockResolvedValue({ rows: [poolRow('a')], total: 5000 });
    const h = harness();
    const { result } = renderHook(() => usePaperTypeMix(h.archive, h.paper, h.bulk));

    act(() => { result.current.openDialog(); });

    await waitFor(() => expect(result.current.poolError).toBeTruthy());
    expect(result.current.pool).toBeNull();
  });

  /**
   * ⚠️ 코덱스 1R 이 짚은 자리 — 되읽는 **사이**에 조건이 바뀌면 옛 폴더에서 뽑은 문항이
   *    들어간다. 폴더 담기가 조회 앞뒤로 두 번 보는 것과 같은 규약이다.
   */
  it('되읽는 사이 폴더가 바뀌면 담지 않는다', async () => {
    fetchTypeMixPool.mockResolvedValue({ rows: [poolRow('a'), poolRow('b')], total: 2 });
    const reload = deferred<ArchiveRow[]>();
    fetchProblemsByIdsForAdd.mockReturnValue(reload.promise);

    const h = harness();
    const { result } = renderHook(() => usePaperTypeMix(h.archive, h.paper, h.bulk));
    act(() => { result.current.openDialog(); });
    await waitFor(() => expect(result.current.pool).toHaveLength(2));

    let confirmed!: Promise<void>;
    act(() => { confirmed = result.current.confirm({ total: 2, objectivePercent: 100 }); });
    // 되읽는 사이 다른 폴더를 눌렀다
    h.bumpFilter();
    await act(async () => {
      reload.resolve([{ id: 'a' } as ArchiveRow, { id: 'b' } as ArchiveRow]);
      await confirmed;
    });

    expect(h.addRows).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalled();
    // 담지 못했으니 창은 열어 둔다 — 조건을 되돌리면 다시 담을 수 있다
    expect(result.current.open).toBe(true);
  });

  it('조건이 그대로면 담고 창을 닫는다', async () => {
    fetchTypeMixPool.mockResolvedValue({ rows: [poolRow('a'), poolRow('b')], total: 2 });
    fetchProblemsByIdsForAdd.mockResolvedValue([{ id: 'a' } as ArchiveRow]);

    const h = harness();
    const { result } = renderHook(() => usePaperTypeMix(h.archive, h.paper, h.bulk));
    act(() => { result.current.openDialog(); });
    await waitFor(() => expect(result.current.pool).toHaveLength(2));

    await act(async () => { await result.current.confirm({ total: 1, objectivePercent: 100 }); });

    expect(h.addRows).toHaveBeenCalledTimes(1);
    expect(result.current.open).toBe(false);
  });
});
