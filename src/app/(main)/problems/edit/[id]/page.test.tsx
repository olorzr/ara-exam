import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Problem } from '@/types/problem-bank';

/**
 * 아카이브의 단건 문항 편집 화면 — 본문 그림 (2026-10-15 리뷰 9번).
 *
 * 카드는 무거운 편집기라 **그림 줄만 진짜로** 그리는 대역으로 바꾼다. 화면이 서명한 지도를
 * 카드에 넘기는지, 그림을 빼고 저장한 뒤 경로가 따라가는지를 본다.
 */

const signProblemFiles = vi.fn();
const fetchProblem = vi.fn();
const updateProblem = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'problem-1' }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/hooks/useSourceTrees', () => ({ useSourceTrees: () => ({ areaTree: [], unitTree: [] }) }));
vi.mock('@/lib/problem-bank/storage', () => ({
  signProblemFiles: (...a: unknown[]) => signProblemFiles(...a),
}));
vi.mock('@/lib/problem-bank/source-queries', () => ({
  fetchProblem: (...a: unknown[]) => fetchProblem(...a),
  fetchSource: async () => ({ title: '합성 출처' }),
}));
vi.mock('@/lib/problem-bank/detail-queries', () => ({ fetchPassagesByIds: async () => [] }));
vi.mock('@/lib/problem-bank/source-label', () => ({ sourceMetaLabel: () => '' }));
vi.mock('@/lib/problem-bank/mutations', () => ({
  ConflictError: class extends Error {},
  deleteProblem: vi.fn(),
  updateProblem: (...a: unknown[]) => updateProblem(...a),
}));
vi.mock('@/components/problem-review/ProblemEditorCard', async () => {
  const { default: FigureStrip } = await import('@/components/problem-review/FigureStrip');
  return {
    default: ({ problem, figureUrls, onSave }: {
      problem: Problem;
      figureUrls?: Map<string, string>;
      onSave: (patch: { figure_paths: string[] }) => Promise<string | null>;
    }) => (
      <div>
        <FigureStrip paths={problem.figure_paths} urls={figureUrls ?? new Map()} onRemove={() => {}} />
        <button type="button" onClick={() => { void onSave({ figure_paths: problem.figure_paths.slice(1) }); }}>
          첫 그림 빼고 저장
        </button>
      </div>
    ),
  };
});

const { default: ProblemEditPage } = await import('./page');

function problem(paths: string[]): Problem {
  return {
    id: 'problem-1', source_id: 'source-1', passage_id: null, number: 1, page_no: 1,
    figure_paths: paths, updated_at: 'v1',
  } as unknown as Problem;
}

/** 받은 경로 전부를 서명해 준다 — `fail` 에 든 경로만 빼고 */
function signAll(fail: string[] = []) {
  return async (paths: string[]) => new Map(
    paths.filter((p) => !fail.includes(p)).map((p) => [p, `https://img/${p}`]),
  );
}

beforeEach(() => {
  signProblemFiles.mockReset().mockImplementation(signAll());
  fetchProblem.mockReset();
  updateProblem.mockReset();
});

describe('단건 문항 편집 — 본문 그림', () => {
  it('⚠️ 기존 그림 한 장을 서명해 카드에 넘긴다', async () => {
    fetchProblem.mockResolvedValue(problem(['figs/a.jpg']));
    render(<ProblemEditPage />);
    expect(await screen.findByAltText('그림 1')).toHaveProperty('src', 'https://img/figs/a.jpg');
    expect(screen.queryByText('불러오지 못했어요')).toBeNull();
  });

  it('여러 장도 모두 보인다', async () => {
    fetchProblem.mockResolvedValue(problem(['figs/a.jpg', 'figs/b.jpg']));
    render(<ProblemEditPage />);
    await screen.findByAltText('그림 2');
    expect(screen.getByAltText('그림 1')).toBeTruthy();
  });

  it('그림이 없는 문항은 서명하지 않는다', async () => {
    fetchProblem.mockResolvedValue(problem([]));
    render(<ProblemEditPage />);
    await screen.findByText('첫 그림 빼고 저장');
    expect(signProblemFiles).not.toHaveBeenCalled();
  });

  it('서명이 실패하면 알리고, 다시 시도로 되살린다', async () => {
    fetchProblem.mockResolvedValue(problem(['figs/a.jpg']));
    signProblemFiles.mockImplementationOnce(signAll(['figs/a.jpg']));
    render(<ProblemEditPage />);

    await screen.findByText('본문 그림 1장을 불러오지 못했어요.');
    expect(screen.getByText('불러오지 못했어요')).toBeTruthy();

    fireEvent.click(screen.getByText('다시 시도'));
    expect(await screen.findByAltText('그림 1')).toBeTruthy();
    expect(screen.queryByText('본문 그림 1장을 불러오지 못했어요.')).toBeNull();
  });

  it('그림을 빼고 저장하면 남은 경로로 다시 그린다', async () => {
    fetchProblem.mockResolvedValue(problem(['figs/a.jpg', 'figs/b.jpg']));
    updateProblem.mockImplementation(async () => ({ updated_at: 'v2' }));
    render(<ProblemEditPage />);
    await screen.findByAltText('그림 2');

    await act(async () => { fireEvent.click(screen.getByText('첫 그림 빼고 저장')); });
    await waitFor(() => expect(screen.queryByAltText('그림 2')).toBeNull());
    expect(screen.getByAltText('그림 1')).toHaveProperty('src', 'https://img/figs/b.jpg');
  });
});
