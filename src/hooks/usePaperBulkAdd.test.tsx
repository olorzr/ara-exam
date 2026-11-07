import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { EMPTY_FILTERS, type ProblemFilters } from '@/lib/problem-bank/filters';
import type { ArchiveRow } from './useProblemArchive';

const fetchProblemsOfPassageForAdd = vi.fn();
const toastError = vi.fn();

vi.mock('@/lib/problem-bank/queries', () => ({
  fetchProblemsForBulkAdd: vi.fn(),
  fetchProblemsOfPassageForAdd: (...args: unknown[]) => fetchProblemsOfPassageForAdd(...args),
}));
vi.mock('sonner', () => ({
  toast: { error: (...args: unknown[]) => toastError(...args), success: vi.fn() },
}));

const { usePaperBulkAdd } = await import('./usePaperBulkAdd');

const NO_ROWS: ArchiveRow[] = [];

function harness(filters: ProblemFilters) {
  const addMany = vi.fn(() => ({ added: 1, skipped: 0 }));
  const archive = { filters, rows: NO_ROWS, total: 0, loading: false, patch: vi.fn(), reset: vi.fn() };
  const paper = { addMany, clearSeq: () => 0 };
  return { addMany, hook: renderHook(() => usePaperBulkAdd(archive, paper)) };
}

const week1 = { id: 'p1', title: '음운 1주차', total_questions: 112 };

/** 손으로 풀 수 있는 약속 — 응답 시점을 시험이 정한다 */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

beforeEach(() => {
  fetchProblemsOfPassageForAdd.mockReset();
  toastError.mockReset();
});

describe("usePaperBulkAdd — '이 지문 전체 담기' 와 빼기 조건", () => {
  it('⚠️ 빼기 조건을 함께 넘긴다 — 폴더 조건은 넘기지 않는다', async () => {
    fetchProblemsOfPassageForAdd.mockResolvedValue([{ id: 'q1' }]);
    const { hook, addMany } = harness({ ...EMPTY_FILTERS, grade: '중2', exclude_papers: [week1], answered_only: true });
    await act(() => hook.result.current.addPassage('passage-1'));
    expect(fetchProblemsOfPassageForAdd).toHaveBeenCalledWith('passage-1', { exclude_paper_ids: ['p1'], answered_only: true });
    expect(addMany).toHaveBeenCalledWith([{ id: 'q1' }]);
  });

  it('빼기로 전부 걸렸으면 그 까닭을 말한다', async () => {
    fetchProblemsOfPassageForAdd.mockResolvedValue([]);
    const { hook, addMany } = harness({ ...EMPTY_FILTERS, answered_only: true });
    await act(() => hook.result.current.addPassage('passage-1'));
    expect(toastError).toHaveBeenCalledWith('그 지문의 문항이 전부 빼기 조건에 걸렸어요.');
    expect(addMany).not.toHaveBeenCalled();
  });

  it.each([
    ['정답 빼기', { answered_only: true }],
    ['문제지 빼기', { exclude_papers: [week1] }],
  ])('⚠️ 조회하는 사이 %s 를 바꾸면 옛 조건으로 받은 문항을 담지 않는다(코덱스 1R)', async (_name, change) => {
    const pending = deferred<{ id: string }[]>();
    fetchProblemsOfPassageForAdd.mockReturnValue(pending.promise);
    const { hook, addMany } = harness(EMPTY_FILTERS);
    let adding: Promise<void> | undefined;
    act(() => { adding = hook.result.current.addPassage('passage-1'); });
    act(() => hook.result.current.patch({ ...change, page: 0 }));
    await act(async () => { pending.resolve([{ id: 'q1' }]); await adding; });
    expect(addMany).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith('빼기 조건이 바뀌어 담지 않았어요. 다시 눌러 주세요.');
  });

  it('폴더만 옮겼으면 담는다 — 지문 담기는 폴더 조건을 안 본다', async () => {
    const pending = deferred<{ id: string }[]>();
    fetchProblemsOfPassageForAdd.mockReturnValue(pending.promise);
    const { hook, addMany } = harness(EMPTY_FILTERS);
    let adding: Promise<void> | undefined;
    act(() => { adding = hook.result.current.addPassage('passage-1'); });
    act(() => hook.result.current.patch({ grade: '중2', page: 0 }));
    act(() => hook.result.current.reset());
    await act(async () => { pending.resolve([{ id: 'q1' }]); await adding; });
    expect(addMany).toHaveBeenCalledWith([{ id: 'q1' }]);
  });

  it('빼기 조건이 없으면 예전 안내 그대로다', async () => {
    fetchProblemsOfPassageForAdd.mockResolvedValue([]);
    const { hook } = harness(EMPTY_FILTERS);
    await act(() => hook.result.current.addPassage('passage-1'));
    expect(toastError).toHaveBeenCalledWith('그 지문의 문항을 찾지 못했어요.');
  });

  it("빼기 조건만으로는 '이 폴더 전체 담기' 가 열리지 않는다 — 문제 은행 전체를 담는 길이 된다", () => {
    const { hook } = harness({ ...EMPTY_FILTERS, exclude_papers: [week1], answered_only: true });
    expect(hook.result.current.folderEnabled).toBe(false);
  });
});
