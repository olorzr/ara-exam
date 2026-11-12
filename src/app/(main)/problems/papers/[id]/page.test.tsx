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
  duplex: 'short' as 'short' | 'long',
  pages: { paper: 3, teacher: 3, key: 1 },
};
const save = vi.fn(async () => true);
const changeDuplex = vi.fn();
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
    bookletDuplex: state.duplex, changeBookletDuplex: changeDuplex,
  }),
}));
vi.mock('@/components/problem-paper/PaperCoverDialog', () => ({ default: () => null }));
const watch = { stale: false, check: vi.fn() };
vi.mock('@/hooks/usePaperRevisionWatch', () => ({ usePaperRevisionWatch: () => watch }));
const toolbar = { printDisabled: false, onPrint: () => {} };
vi.mock('@/components/problem-paper/PaperViewToolbar', () => ({
  default: ({ onModeChange, printDisabled, onPrint }: { onModeChange: (mode: string) => void; printDisabled: boolean; onPrint: () => void }) => {
    toolbar.printDisabled = printDisabled;
    toolbar.onPrint = onPrint;
    return (
      <div>
        {(['paper', 'teacher', 'key'] as const).map((mode) => (
          <button key={mode} type="button" onClick={() => onModeChange(mode)}>{`판:${mode}`}</button>
        ))}
      </div>
    );
  },
}));

/** 엔진 대역 — 마운트하거나 알림 받이가 바뀌면 그 판의 본문 쪽 수를 알린다 */
function useReport(onLayout: LayoutHandler | undefined, pageCount: number) {
  useEffect(() => {
    const info: A4LayoutInfo = { pageCount, blockPages: [] };
    onLayout?.(info);
  }, [onLayout, pageCount]);
}
interface DoubleProps { showAnswers?: boolean; onLayout?: LayoutHandler; bookletDuplex?: string }
vi.mock('@/components/problem-paper/ProblemPaperView', () => ({
  default: function PaperDouble({ showAnswers, onLayout, bookletDuplex }: DoubleProps) {
    useEffect(() => { mounts.paper += 1; }, []);
    useReport(onLayout, showAnswers ? state.pages.teacher : state.pages.paper);
    return <div data-duplex={bookletDuplex}>{showAnswers ? '교사용 문서' : '학생용 문서'}</div>;
  },
}));
vi.mock('@/components/problem-paper/ProblemAnswerKeyView', () => ({
  default: function KeyDouble({ onLayout, bookletDuplex }: DoubleProps) {
    useReport(onLayout, state.pages.key);
    return <div data-duplex={bookletDuplex}>답지 문서</div>;
  },
}));

const { default: ProblemPaperViewPage } = await import('./page');

const designBack: PaperCover = { ...DEFAULT_SIMPLE_COVER, backKind: 'design' };
const ADVICE = '뒷표지만 빼면 빈 면 없이 딱 맞아요.';
const advice = () => screen.queryByText(ADVICE);

beforeEach(() => {
  state.cover = designBack;
  state.printLayout = 'booklet';
  state.duplex = 'short';
  state.pages = { paper: 3, teacher: 3, key: 1 };
  mounts.paper = 0;
  save.mockClear();
  changeDuplex.mockClear();
});

describe('문제지 보기 — 중철 양면 넘김 방향', () => {
  it('기억해 둔 방향이 학생용·교사용·답지 문서에 모두 가고, 안내의 단추가 방향을 바꾼다', () => {
    state.duplex = 'long';
    render(<ProblemPaperViewPage />);
    expect(screen.getByText('학생용 문서').getAttribute('data-duplex')).toBe('long');
    fireEvent.click(screen.getByRole('button', { name: '판:teacher' }));
    expect(screen.getByText('교사용 문서').getAttribute('data-duplex')).toBe('long');
    fireEvent.click(screen.getByRole('button', { name: '판:key' }));
    expect(screen.getByText('답지 문서').getAttribute('data-duplex')).toBe('long');
    expect(screen.getByRole('button', { name: '긴 쪽' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: '짧은 쪽' }));
    expect(changeDuplex).toHaveBeenCalledWith('short');
  });

  it('낱장이면 방향 단추를 내지 않는다', () => {
    state.printLayout = 'single';
    render(<ProblemPaperViewPage />);
    expect(screen.queryByRole('group', { name: '양면 넘김 방향' })).toBeNull();
  });
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

describe('문제지 보기 — 다른 곳에서 고쳐짐(sql/103)', () => {
  it('열어 둔 사이 고쳐졌으면 인쇄를 잠그고 인쇄물에도 찍히는 안내를 띄운다', () => {
    watch.stale = true;
    render(<ProblemPaperViewPage />);
    const notice = screen.getByRole('alert');
    expect(notice.textContent).toMatch(/다른 곳에서 이 문제지가 고쳐졌어요/);
    expect(notice.hasAttribute('data-no-print')).toBe(false);
    expect(toolbar.printDisabled).toBe(true);
    watch.stale = false;
  });

  it('고쳐졌으면 문서를 그리지 않는다(중철 면 앞에 안내가 끼면 면 짝이 밀린다)', () => {
    watch.stale = true;
    const before = mounts.paper;
    render(<ProblemPaperViewPage />);
    expect(mounts.paper).toBe(before);
    watch.stale = false;
  });

  it('인쇄 직전에 판을 확인하고, 바뀌었으면 인쇄하지 않는다', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    watch.check.mockResolvedValueOnce(true);
    render(<ProblemPaperViewPage />);
    await act(async () => { toolbar.onPrint(); await Promise.resolve(); });
    expect(watch.check).toHaveBeenCalled();
    expect(print).not.toHaveBeenCalled();
    watch.check.mockResolvedValueOnce(false);
    await act(async () => { toolbar.onPrint(); await Promise.resolve(); });
    expect(print).toHaveBeenCalledTimes(1);
    print.mockRestore();
  });

  it('판을 확인하는 사이 잠금이 다시 걸리면 인쇄하지 않고, 확인하는 동안은 단추를 잠근다(두 번 누르지 않게)', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    let resolve: (v: boolean) => void = () => {};
    watch.check.mockReset();
    watch.check.mockReturnValueOnce(new Promise<boolean>((r) => { resolve = r; }));
    const { rerender } = render(<ProblemPaperViewPage />);
    act(() => { toolbar.onPrint(); });
    expect(toolbar.printDisabled).toBe(true); // 확인하는 동안
    watch.stale = true; // 그사이 잠금이 걸렸다
    rerender(<ProblemPaperViewPage />);
    await act(async () => { resolve(false); await Promise.resolve(); });
    expect(print).not.toHaveBeenCalled();
    watch.stale = false;
    print.mockRestore();
  });
});

