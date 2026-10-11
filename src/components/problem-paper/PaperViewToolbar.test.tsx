import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import PaperViewToolbar from './PaperViewToolbar';
import type { ProblemPaper } from '@/types/problem-bank';

const PAPER = {
  id: 'paper-1', title: '서시 문제지', total_questions: 3, source_labels: [],
  settings: { columns: 2, showScore: false, showSource: true, omr: false },
} as unknown as ProblemPaper;

function renderToolbar(trimWorks?: { checked: boolean; onChange: (on: boolean) => void }) {
  return render(
    <PaperViewToolbar
      paper={PAPER} itemCount={3} mode="paper" onModeChange={() => {}}
      printLayout="single" onPrintLayoutChange={() => {}}
      cover={null} onCoverClick={() => {}}
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
