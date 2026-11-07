import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('./PaperExcludePickerDialog', () => ({
  default: ({ open, onApply }: { open: boolean; onApply: (papers: unknown[]) => void }) => (open
    ? <button type="button" onClick={() => onApply([{ id: 'p9', title: '새로 고른 문제지', total_questions: 3 }])}>적용</button>
    : null),
}));

const { default: PaperExcludeBar } = await import('./PaperExcludeBar');

const week1 = { id: 'p1', title: '음운 1주차 (120문제)', total_questions: 112 };
const week2 = { id: 'p2', title: '음운 2주차', total_questions: 80 };

describe('PaperExcludeBar', () => {
  it('정답 빼기 칸은 켜고 끌 수 있고, 첫 쪽으로 돌아간다', () => {
    const onChange = vi.fn();
    render(<PaperExcludeBar papers={[]} answeredOnly onChange={onChange} />);
    const box = screen.getByRole<HTMLInputElement>('checkbox', { name: '정답 없는 문항 빼기' });
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledWith({ answered_only: false, page: 0 });
  });

  it('고른 문제지는 제목과 문항 수로 보여 지금 무엇을 빼는지 알 수 있다', () => {
    render(<PaperExcludeBar papers={[week1]} answeredOnly={false} onChange={vi.fn()} />);
    const list = screen.getByRole('list', { name: '문항을 빼고 있는 문제지' });
    expect(list.textContent).toContain('음운 1주차 (120문제)');
    expect(list.textContent).toContain('112문항');
  });

  it('× 는 그 문제지만 푼다', () => {
    const onChange = vi.fn();
    render(<PaperExcludeBar papers={[week1, week2]} answeredOnly={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '음운 1주차 (120문제) 빼기 풀기' }));
    expect(onChange).toHaveBeenCalledWith({ exclude_papers: [week2], page: 0 });
  });

  it("'모두 풀기' 는 둘 이상일 때만 나오고 전부 푼다", () => {
    const onChange = vi.fn();
    const { rerender } = render(<PaperExcludeBar papers={[week1]} answeredOnly={false} onChange={onChange} />);
    expect(screen.queryByRole('button', { name: '모두 풀기' })).toBeNull();
    rerender(<PaperExcludeBar papers={[week1, week2]} answeredOnly={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '모두 풀기' }));
    expect(onChange).toHaveBeenCalledWith({ exclude_papers: [], page: 0 });
  });

  it('고르기 창에서 정한 문제지로 바꾸고 창을 닫는다', () => {
    const onChange = vi.fn();
    render(<PaperExcludeBar papers={[]} answeredOnly={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '다른 문제지에 담긴 문항 빼기' }));
    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    expect(onChange).toHaveBeenCalledWith({
      exclude_papers: [{ id: 'p9', title: '새로 고른 문제지', total_questions: 3 }], page: 0,
    });
    expect(screen.queryByRole('button', { name: '적용' })).toBeNull();
  });
});
