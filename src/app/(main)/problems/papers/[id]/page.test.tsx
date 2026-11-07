import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { A4LayoutInfo, LayoutHandler } from '@/hooks/useA4Pagination';
import { DEFAULT_SIMPLE_COVER, type PaperCover } from '@/lib/problem-paper/cover';
import type { ProblemPaper } from '@/types/problem-bank';

/**
 * 문제지 보기 화면 — 중철에서 뒷표지만 빼면 딱 맞을 때의 안내(2026-11-07).
 *
 * 무거운 문서는 대역으로 바꾼다. 대역은 엔진처럼 마운트·알림 받이가 바뀔 때 본문 쪽 수를 알린다
 * (`useA4Pagination` 의 `onLayout` 효과). 판마다 쪽 수를 따로 정해 판을 바꿀 때를 본다.
 */

const paper: ProblemPaper = {
  id: 'paper-1', title: '음운 1주차', settings: { columns: 2, showScore: false, showSource: true, omr: false },
  source_labels: [], total_questions: 0, user_id: 'u1', updated_by: null,
  created_at: '2026-11-07T00:00:00Z', updated_at: '2026-11-07T00:00:00Z',
};

const state = {
  cover: null as PaperCover | null,
  printLayout: 'booklet' as 'single' | 'booklet',
  pages: { paper: 3, teacher: 3, key: 1 },
};
const save = vi.fn(async () => true);
const mounts = { paper: 0 };

vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'paper-1' }) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/hooks/usePaperLoad', () => ({
  usePaperLoad: () => ({ paper, items: [], loaded: true, creatorName: '' }),
}));
vi.mock('@/hooks/usePaperCover', () => ({
  usePaperCover: () => ({
    cover: state.cover, loading: false, failed: false, reload: vi.fn(), saving: false, save, remove: vi.fn(),
  }),
}));
vi.mock('@/hooks/useCoverImages', () => ({
  useCoverImages: () => ({ pending: false, broken: false, frontBroken: false, backBroken: false, reload: vi.fn() }),
}));
vi.mock('@/hooks/useSignedImageUrls', () => ({
  useSignedImageUrls: () => ({ urls: new Map(), loading: false, missing: [], reload: vi.fn() }),
}));
vi.mock('@/hooks/useImagesReady', () => ({ useImagesReady: () => ({ loading: false, failed: [] }) }));
vi.mock('@/hooks/useCoverFontsReady', () => ({ useCoverFontsReady: () => true }));
vi.mock('@/hooks/usePaperPrintPrefs', () => ({
  usePaperPrintPrefs: () => ({
    printLayout: state.printLayout, changePrintLayout: vi.fn(), trimWorks: false, changeTrimWorks: vi.fn(),
  }),
}));
vi.mock('@/components/problem-paper/PaperCoverDialog', () => ({ default: () => null }));
vi.mock('@/components/problem-paper/PaperViewToolbar', () => ({
  default: ({ onModeChange }: { onModeChange: (mode: string) => void }) => (
    <div>
      {(['paper', 'teacher', 'key'] as const).map((mode) => (
        <button key={mode} type="button" onClick={() => onModeChange(mode)}>{`판:${mode}`}</button>
      ))}
    </div>
  ),
}));

/** 엔진 대역 — 마운트하거나 알림 받이가 바뀌면 그 판의 본문 쪽 수를 알린다 */
function useReport(onLayout: LayoutHandler | undefined, pageCount: number) {
  useEffect(() => {
    const info: A4LayoutInfo = { pageCount, blockPages: [] };
    onLayout?.(info);
  }, [onLayout, pageCount]);
}
vi.mock('@/components/problem-paper/ProblemPaperView', () => ({
  default: function PaperDouble({ showAnswers, onLayout }: { showAnswers?: boolean; onLayout?: LayoutHandler }) {
    useEffect(() => { mounts.paper += 1; }, []);
    useReport(onLayout, showAnswers ? state.pages.teacher : state.pages.paper);
    return <div>{showAnswers ? '교사용 문서' : '학생용 문서'}</div>;
  },
}));
vi.mock('@/components/problem-paper/ProblemAnswerKeyView', () => ({
  default: function KeyDouble({ onLayout }: { onLayout?: LayoutHandler }) {
    useReport(onLayout, state.pages.key);
    return <div>답지 문서</div>;
  },
}));

const { default: ProblemPaperViewPage } = await import('./page');

const designBack: PaperCover = { ...DEFAULT_SIMPLE_COVER, backKind: 'design' };
const ADVICE = '뒷표지만 빼면 빈 면 없이 딱 맞아요.';
const advice = () => screen.queryByText(ADVICE);

beforeEach(() => {
  state.cover = designBack;
  state.printLayout = 'booklet';
  state.pages = { paper: 3, teacher: 3, key: 1 };
  mounts.paper = 0;
  save.mockClear();
});

describe('문제지 보기 — 중철 뒷표지 안내', () => {
  it('본문 3쪽 + 앞·뒷표지면 안내가 뜨고, 뒷표지 없애기는 뒷표지만 걷어 저장한다', () => {
    render(<ProblemPaperViewPage />);
    expect(advice()).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '뒷표지 없애기' }));
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ ...designBack, backKind: 'none', backImagePath: '' });
  });

  it('본문이 4쪽이면 뒷표지를 빼도 딱 맞지 않아 띄우지 않는다', () => {
    state.pages.paper = 4;
    render(<ProblemPaperViewPage />);
    expect(advice()).toBeNull();
  });

  it('낱장이거나 뒷표지가 없으면 띄우지 않는다', () => {
    state.printLayout = 'single';
    const { unmount } = render(<ProblemPaperViewPage />);
    expect(advice()).toBeNull();
    unmount();
    state.printLayout = 'booklet';
    state.cover = { ...designBack, backKind: 'none' };
    render(<ProblemPaperViewPage />);
    expect(advice()).toBeNull();
  });

  it('그대로 두기를 누르면 이 화면에서 접고 저장하지 않는다', () => {
    render(<ProblemPaperViewPage />);
    fireEvent.click(screen.getByRole('button', { name: '그대로 두기' }));
    expect(advice()).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  it('저장해 뒷표지가 빠지면 안내가 저절로 사라진다', () => {
    const view = render(<ProblemPaperViewPage />);
    expect(advice()).not.toBeNull();
    state.cover = { ...designBack, backKind: 'none' };
    view.rerender(<ProblemPaperViewPage />);
    expect(advice()).toBeNull();
  });

  it('판마다 그 판의 쪽 수로 판단하고, 교사용으로 바꾸면 문서를 새로 마운트한다', () => {
    state.pages = { paper: 3, teacher: 3, key: 1 };
    render(<ProblemPaperViewPage />);
    expect(advice()).not.toBeNull();
    act(() => { fireEvent.click(screen.getByRole('button', { name: '판:key' })); });
    expect(screen.getByText('답지 문서')).not.toBeNull();
    expect(advice()).toBeNull();
    const before = mounts.paper;
    act(() => { fireEvent.click(screen.getByRole('button', { name: '판:teacher' })); });
    expect(mounts.paper).toBe(before + 1);
    expect(advice()).not.toBeNull();
    act(() => { fireEvent.click(screen.getByRole('button', { name: '판:paper' })); });
    expect(mounts.paper).toBe(before + 2);
    expect(advice()).not.toBeNull();
  });
});
