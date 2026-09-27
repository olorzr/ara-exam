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

/**
 * 훅에 넘길 세 짝 — 조건 세대와 잠금을 시험이 쥔다.
 *
 * ⚠️ 잠금은 **실제로 잠기는** 것을 쓴다(늘 성공하는 목이 아니다). 폴더·지문 담기와 하나를
 *    나눠 쓰므로, 취소 뒤에 정말 풀렸는지·남의 잠금을 풀지 않는지를 봐야 한다(코덱스 1R).
 */
function harness() {
  let seq = 0;
  let locked = false;
  const release = vi.fn(() => { locked = false; });
  const addRows = vi.fn(() => true);
  const bulk = {
    addRows,
    filterSeq: () => seq,
    lock: {
      acquire: () => {
        if (locked) return false;
        locked = true;
        return true;
      },
      release,
    },
  };
  const paper = { added: new Set<string>(), clearSeq: () => 0 };
  const archive = { filters: EMPTY_FILTERS, total: 10 };
  return {
    archive, paper, bulk, addRows, release,
    isLocked: () => locked,
    bumpFilter: () => { seq += 1; },
  };
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

  /**
   * ⚠️ 코덱스 정지 게이트가 짚은 자리 — 창 오른쪽 위 X·Escape·바깥 누르기는 담는 중에도
   *    눌리는데, 그때 그냥 닫기만 하면 조회가 끝난 뒤 **닫은 창의 문항이 담긴다**.
   */
  it('되읽는 사이 창을 닫으면 담지 않는다 — 닫은 것이 곧 취소다', async () => {
    fetchTypeMixPool.mockResolvedValue({ rows: [poolRow('a'), poolRow('b')], total: 2 });
    const reload = deferred<ArchiveRow[]>();
    fetchProblemsByIdsForAdd.mockReturnValue(reload.promise);

    const h = harness();
    const { result } = renderHook(() => usePaperTypeMix(h.archive, h.paper, h.bulk));
    act(() => { result.current.openDialog(); });
    await waitFor(() => expect(result.current.pool).toHaveLength(2));

    let confirmed!: Promise<void>;
    act(() => { confirmed = result.current.confirm({ total: 2, objectivePercent: 100 }); });
    // 되읽는 사이 X 를 눌러 창을 닫았다
    act(() => { result.current.close(); });
    await act(async () => {
      reload.resolve([{ id: 'a' } as ArchiveRow, { id: 'b' } as ArchiveRow]);
      await confirmed;
    });

    expect(h.addRows).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalled();
    expect(result.current.open).toBe(false);
  });

  /**
   * ⚠️ 코덱스 1R — 세대 검사로 결과만 버리고 잠금을 쥔 채 두면, 닫자마자 다시 열 수도
   *    폴더·지문 담기를 할 수도 없고 조회가 멎으면 **영영 잠긴다**.
   */
  it('취소하면 잠금이 곧바로 풀려 바로 다시 담을 수 있다', async () => {
    fetchTypeMixPool.mockResolvedValue({ rows: [poolRow('a'), poolRow('b')], total: 2 });
    const first = deferred<ArchiveRow[]>();
    const second = deferred<ArchiveRow[]>();
    fetchProblemsByIdsForAdd.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const h = harness();
    const { result } = renderHook(() => usePaperTypeMix(h.archive, h.paper, h.bulk));
    act(() => { result.current.openDialog(); });
    await waitFor(() => expect(result.current.pool).toHaveLength(2));

    let firstRun!: Promise<void>;
    act(() => { firstRun = result.current.confirm({ total: 1, objectivePercent: 100 }); });
    expect(h.isLocked()).toBe(true);

    // 되읽는 사이 창을 닫았다 — 잠금이 그 자리에서 풀려야 한다
    act(() => { result.current.close(); });
    expect(h.isLocked()).toBe(false);
    expect(result.current.busy).toBe(false);

    // 곧바로 다시 열어 담는다
    act(() => { result.current.openDialog(); });
    await waitFor(() => expect(result.current.pool).toHaveLength(2));
    let secondRun!: Promise<void>;
    act(() => { secondRun = result.current.confirm({ total: 1, objectivePercent: 100 }); });
    expect(h.isLocked()).toBe(true);

    // 취소한 옛 작업이 이제야 끝난다 — 담지도, **새 잠금을 풀지도** 않아야 한다
    await act(async () => {
      first.resolve([{ id: 'a' } as ArchiveRow]);
      await firstRun;
    });
    expect(h.addRows).not.toHaveBeenCalled();
    expect(h.isLocked()).toBe(true);

    await act(async () => {
      second.resolve([{ id: 'b' } as ArchiveRow]);
      await secondRun;
    });
    expect(h.addRows).toHaveBeenCalledTimes(1);
    expect(h.isLocked()).toBe(false);
  });

  /** 풀을 읽는 중에는 잠금을 쥐지 않는다 — 닫아도 남의 담기를 풀면 안 된다 */
  it('풀을 읽는 중에 닫아도 잠금을 건드리지 않는다', async () => {
    const pool = deferred<{ rows: TypeMixRow[]; total: number }>();
    fetchTypeMixPool.mockReturnValue(pool.promise);

    const h = harness();
    const { result } = renderHook(() => usePaperTypeMix(h.archive, h.paper, h.bulk));
    act(() => { result.current.openDialog(); });
    act(() => { result.current.close(); });

    expect(h.release).not.toHaveBeenCalled();
    await act(async () => { pool.resolve({ rows: [poolRow('a')], total: 1 }); });
    // 닫은 뒤 도착한 풀은 버린다
    expect(result.current.pool).toBeNull();
  });

  /** ⚠️ 코덱스 2R — 화면은 담는 중에 이 단추를 잠그지만 훅이 그 전제에 기대면 안 된다 */
  it('담는 중에 다시 열어도 잠금이 남지 않는다', async () => {
    fetchTypeMixPool.mockResolvedValue({ rows: [poolRow('a')], total: 1 });
    const first = deferred<ArchiveRow[]>();
    fetchProblemsByIdsForAdd.mockReturnValue(first.promise);

    const h = harness();
    const { result } = renderHook(() => usePaperTypeMix(h.archive, h.paper, h.bulk));
    act(() => { result.current.openDialog(); });
    await waitFor(() => expect(result.current.pool).toHaveLength(1));

    let firstRun!: Promise<void>;
    act(() => { firstRun = result.current.confirm({ total: 1, objectivePercent: 100 }); });
    expect(h.isLocked()).toBe(true);

    // 담는 중에 창을 다시 열었다 — 그 담기는 취소다
    act(() => { result.current.openDialog(); });
    expect(h.isLocked()).toBe(false);
    expect(result.current.busy).toBe(false);

    await act(async () => {
      first.resolve([{ id: 'a' } as ArchiveRow]);
      await firstRun;
    });
    expect(h.addRows).not.toHaveBeenCalled();
    expect(h.isLocked()).toBe(false);
  });

  /** 조회가 멎은 채 화면을 떠나면 잠금이 영영 남는다 */
  it('담는 중에 화면을 떠나면 잠금을 푼다', async () => {
    fetchTypeMixPool.mockResolvedValue({ rows: [poolRow('a')], total: 1 });
    fetchProblemsByIdsForAdd.mockReturnValue(deferred<ArchiveRow[]>().promise);

    const h = harness();
    const { result, unmount } = renderHook(() => usePaperTypeMix(h.archive, h.paper, h.bulk));
    act(() => { result.current.openDialog(); });
    await waitFor(() => expect(result.current.pool).toHaveLength(1));
    act(() => { void result.current.confirm({ total: 1, objectivePercent: 100 }); });
    expect(h.isLocked()).toBe(true);

    unmount();

    expect(h.isLocked()).toBe(false);
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
