import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

/**
 * 아카이브 목록 — 조회 실패 (2026-10-15 리뷰 5번).
 *
 * 지금 조건의 성공 결과가 없으면 **옛 조건의 행을 내주지 않는다** — 화면은 그 행을 새 조건의
 * 결과처럼 그리고, 선택·담기·삭제·태깅도 그 행을 대상으로 삼는다.
 */

const fetchProblemPage = vi.fn();
const toastError = vi.fn();

vi.mock('@/lib/problem-bank/queries', () => ({
  fetchProblemPage: (...a: unknown[]) => fetchProblemPage(...a),
  PROBLEM_PAGE_SIZE: 60,
}));
vi.mock('@/lib/problem-bank/facets', () => ({
  EMPTY_SOURCE_FACETS: {},
  fetchAreaFacets: async () => [],
  fetchGrammarFacets: async () => [],
  fetchSourceFacets: async () => ({}),
  fetchUnitFacets: async () => [],
  fetchWorkFacets: async () => [],
}));
vi.mock('sonner', () => ({ toast: { error: (...a: unknown[]) => toastError(...a) } }));

const { useProblemArchive } = await import('./useProblemArchive');

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const page = (id: string, total = 50) => ({ rows: [{ id }], total });

beforeEach(() => {
  fetchProblemPage.mockReset();
  toastError.mockReset();
});

/** 처음 목록(old)을 읽어 둔 훅 */
async function loaded() {
  fetchProblemPage.mockResolvedValueOnce(page('old-middle'));
  const hook = renderHook(() => useProblemArchive());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(hook.result.current.rows.map((r) => r.id)).toEqual(['old-middle']);
  return hook;
}

describe('useProblemArchive — 새 조건 조회 실패', () => {
  const changes: [string, Record<string, unknown>][] = [
    ['학년', { grade: '고2' }],
    ['작품', { work_title: '서시' }],
    ['문법', { grammar_path: ['음운', '음운 변동'] }],
    ['쪽', { page: 3 }],
  ];

  for (const [name, next] of changes) {
    it(`⚠️ ${name}을 바꾼 조회가 실패하면 옛 행·개수를 내주지 않는다`, async () => {
      const { result } = await loaded();
      fetchProblemPage.mockRejectedValueOnce(new Error('query failed'));
      act(() => result.current.patch(next));

      await waitFor(() => expect(result.current.failed).toBe('query'));
      expect(result.current.loading).toBe(false);
      expect(result.current.rows).toEqual([]);
      expect(result.current.total).toBe(0);
      expect(toastError).toHaveBeenCalled();
    });
  }

  it('검색 조회가 실패해도 옛 행을 내주지 않는다', async () => {
    const { result } = await loaded();
    fetchProblemPage.mockRejectedValueOnce(new Error('search failed'));
    act(() => result.current.patch({ search: '소나기' }));
    await waitFor(() => expect(result.current.failed).toBe('query'), { timeout: 2000 });
    expect(result.current.rows).toEqual([]);
  });

  it('다시 시도하면 그 조건을 다시 읽어 보여 준다', async () => {
    const { result } = await loaded();
    fetchProblemPage.mockRejectedValueOnce(new Error('query failed'));
    act(() => result.current.patch({ grade: '고2' }));
    await waitFor(() => expect(result.current.failed).toBe('query'));

    fetchProblemPage.mockResolvedValueOnce(page('high-2', 7));
    act(() => result.current.retry());
    expect(result.current.loading).toBe(true);
    expect(result.current.failed).toBeNull();
    await waitFor(() => expect(result.current.rows.map((r) => r.id)).toEqual(['high-2']));
    expect(result.current.total).toBe(7);
    expect(result.current.failed).toBeNull();
  });
});

describe('useProblemArchive — 같은 조건 재조회 실패', () => {
  it('⚠️ 지운 뒤 다시 읽기가 실패하면 지운 행이 남은 옛 목록을 내주지 않는다', async () => {
    const { result } = await loaded();
    fetchProblemPage.mockRejectedValueOnce(new Error('reload failed'));
    act(() => result.current.reload());

    await waitFor(() => expect(result.current.failed).toBe('refresh'));
    expect(result.current.rows).toEqual([]);
    expect(result.current.total).toBe(0);
  });
});

describe('useProblemArchive — 응답 순서', () => {
  it('⚠️ 늦게 온 옛 조건의 실패가 최신 목록을 실패로 덮지 않는다', async () => {
    const { result } = await loaded();
    const slow = deferred<ReturnType<typeof page>>();
    fetchProblemPage.mockReturnValueOnce(slow.promise).mockResolvedValueOnce(page('mid-3'));

    act(() => result.current.patch({ grade: '고2' }));
    act(() => result.current.patch({ grade: '중3' }));
    await waitFor(() => expect(result.current.rows.map((r) => r.id)).toEqual(['mid-3']));

    await act(async () => { slow.reject(new Error('late failure')); await Promise.resolve(); });
    expect(result.current.failed).toBeNull();
    expect(result.current.rows.map((r) => r.id)).toEqual(['mid-3']);
  });

  it('늦게 온 옛 조건의 성공도 버린다', async () => {
    const { result } = await loaded();
    const slow = deferred<ReturnType<typeof page>>();
    fetchProblemPage.mockReturnValueOnce(slow.promise).mockResolvedValueOnce(page('mid-3'));

    act(() => result.current.patch({ grade: '고2' }));
    act(() => result.current.patch({ grade: '중3' }));
    await waitFor(() => expect(result.current.rows.map((r) => r.id)).toEqual(['mid-3']));

    await act(async () => { slow.resolve(page('high-2')); await Promise.resolve(); });
    expect(result.current.rows.map((r) => r.id)).toEqual(['mid-3']);
  });

  it('⚠️ 같은 조건으로 돌아와 다시 읽기가 실패하면 옛 행을 내주지 않는다 (코덱스 1R)', async () => {
    const { result } = await loaded();
    // 고2 를 묻는 사이(아직 안 왔다) 처음 조건으로 되돌아온다 — 처음 결과가 그대로 남아 있던 자리다
    const away = deferred<ReturnType<typeof page>>();
    const back = deferred<ReturnType<typeof page>>();
    fetchProblemPage.mockReturnValueOnce(away.promise).mockReturnValueOnce(back.promise);
    act(() => result.current.patch({ grade: '고2' }));
    act(() => result.current.patch({ grade: '' }));
    expect(result.current.loading).toBe(true);
    expect(result.current.rows).toEqual([]);

    await act(async () => { back.reject(new Error('back failed')); await Promise.resolve(); });
    await waitFor(() => expect(result.current.failed).not.toBeNull());
    expect(result.current.rows).toEqual([]);
  });

  it('실패한 조건을 떠났다 돌아오면 다시 읽는 동안 옛 실패를 띄우지 않는다', async () => {
    const { result } = await loaded();
    fetchProblemPage.mockRejectedValueOnce(new Error('query failed'));
    act(() => result.current.patch({ grade: '고2' }));
    await waitFor(() => expect(result.current.failed).toBe('query'));

    fetchProblemPage.mockResolvedValueOnce(page('mid-3'));
    act(() => result.current.patch({ grade: '중3' }));
    await waitFor(() => expect(result.current.rows.map((r) => r.id)).toEqual(['mid-3']));

    const back = deferred<ReturnType<typeof page>>();
    fetchProblemPage.mockReturnValueOnce(back.promise);
    act(() => result.current.patch({ grade: '고2' }));
    expect(result.current.failed).toBeNull();
    expect(result.current.loading).toBe(true);
    await act(async () => { back.resolve(page('high-2')); await Promise.resolve(); });
    await waitFor(() => expect(result.current.rows.map((r) => r.id)).toEqual(['high-2']));
  });
});
