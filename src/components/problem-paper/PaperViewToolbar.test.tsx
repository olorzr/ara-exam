import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import PaperViewToolbar from './PaperViewToolbar';
import { DEFAULT_SIMPLE_COVER, type PaperCover } from '@/lib/problem-paper/cover';
import type { ProblemPaper } from '@/types/problem-bank';

const PAPER = {
  id: 'paper-1', title: '서시 문제지', total_questions: 3, source_labels: [],
  settings: { columns: 2, showScore: false, showSource: true, omr: false },
} as unknown as ProblemPaper;

function renderToolbar(
  trimWorks?: { checked: boolean; onChange: (on: boolean) => void },
  cover: PaperCover | null = null,
) {
  return render(
    <PaperViewToolbar
      paper={PAPER} itemCount={3} mode="paper" onModeChange={() => {}}
      printLayout="single" onPrintLayoutChange={() => {}}
      cover={cover} onCoverClick={() => {}}
      printLabel="인쇄" printDisabled={false} onPrint={() => {}}
      trimWorks={trimWorks}
    />,
  );
}

describe('PaperViewToolbar — 묻는 작품만 인쇄', () => {
  it('뺄 수 있는 지문이 없으면(옛 문제지 포함) 칸을 그리지 않는다', () => {
    renderToolbar();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('켜진 상태를 보이고, 누르면 끈다', () => {
    const onChange = vi.fn();
    renderToolbar({ checked: true, onChange });
    const box = screen.getByRole('checkbox', { name: '복합 지문은 묻는 작품만' }) as HTMLInputElement;
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(false);
  });
});

describe('PaperViewToolbar — 표지 단추', () => {
  it('표지 종류와 디자인 이름을 보인다', () => {
    const { unmount } = renderToolbar(undefined, null);
    expect(screen.getByRole('button', { name: '표지' })).toBeTruthy();
    unmount();
    renderToolbar(undefined, { ...DEFAULT_SIMPLE_COVER, layout: 'spines' });
    expect(screen.getByRole('button', { name: '표지 · 책등' })).toBeTruthy();
  });

  it('예전 모양(간단)과 그림 표지는 예전 문구 그대로', () => {
    const { unmount } = renderToolbar(undefined, DEFAULT_SIMPLE_COVER);
    expect(screen.getByRole('button', { name: '표지 · 간단' })).toBeTruthy();
    unmount();
    renderToolbar(undefined, { ...DEFAULT_SIMPLE_COVER, kind: 'image', imagePath: 'x' });
    expect(screen.getByRole('button', { name: '표지 · 그림' })).toBeTruthy();
  });

  it('뒷표지가 있으면 꼬리를 단다', () => {
    renderToolbar(undefined, { ...DEFAULT_SIMPLE_COVER, layout: 'zine', backKind: 'design' });
    expect(screen.getByRole('button', { name: '표지 · 라인드로잉 · 뒷표지' })).toBeTruthy();
  });
});
