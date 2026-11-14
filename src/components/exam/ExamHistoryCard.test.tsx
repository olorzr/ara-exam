import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const { default: ExamHistoryCard } = await import('./ExamHistoryCard');

const exam = {
  id: 'e1', title: '중2 비상 2단원 어휘', pass_percentage: 80, total_questions: 30, pass_count: 24,
  parent_exam_id: null, retake_number: 0, created_at: '2026-11-11T05:00:00Z',
};

describe('ExamHistoryCard', () => {
  it('재시험·지우기 단추가 늘 보이고(예전엔 마우스를 올려야 보였다), 누르면 시험지 보기로 가지 않는다', () => {
    const onRetest = vi.fn();
    const onDelete = vi.fn();
    push.mockClear();
    render(<ExamHistoryCard exam={exam} onDelete={onDelete} onRetest={onRetest} />);
    const retest = screen.getByRole('button', { name: '재시험지 생성' });
    const del = screen.getByRole('button', { name: '시험지 삭제' });
    for (const el of [retest, del, retest.parentElement!]) expect(el.className).not.toContain('opacity-0');
    fireEvent.click(retest);
    fireEvent.click(del);
    expect(onRetest).toHaveBeenCalledWith('e1');
    expect(onDelete).toHaveBeenCalledWith('e1');
    expect(push).not.toHaveBeenCalled();
  });

  it('꼭지를 누르면 시험지 보기로 가고, 재시험 줄도 지우기가 늘 보인다', () => {
    push.mockClear();
    render(<ExamHistoryCard exam={exam} retakes={[{ ...exam, id: 'e2', retake_number: 1, total_questions: 6 }]} onDelete={vi.fn()} onRetest={vi.fn()} />);
    fireEvent.click(screen.getByText('중2 비상 2단원 어휘'));
    expect(push).toHaveBeenCalledWith('/exam/view?id=e1');
    expect(screen.getByText('재시험 1차')).toBeTruthy();
    expect(screen.getByRole('button', { name: '재시험지 삭제' }).className).not.toContain('opacity-0');
  });

  it('고르는 중이면 단추 대신 체크 상자 — 누르면 고르기만 한다', () => {
    const onToggle = vi.fn();
    push.mockClear();
    render(<ExamHistoryCard exam={exam} onDelete={vi.fn()} onRetest={vi.fn()} selectMode selected={false} onToggleSelect={onToggle} />);
    expect(screen.queryByRole('button', { name: '재시험지 생성' })).toBeNull();
    fireEvent.click(screen.getByText('중2 비상 2단원 어휘'));
    expect(onToggle).toHaveBeenCalledWith('e1');
    expect(push).not.toHaveBeenCalled();
  });

  it('재시험지를 만드는 중(잠긴 단추)에 그 자리를 눌러도 시험지 보기로 가지 않는다(코덱스 1R)', () => {
    push.mockClear();
    render(<ExamHistoryCard exam={exam} onDelete={vi.fn()} onRetest={vi.fn()} retesting />);
    const retest = screen.getByRole('button', { name: '재시험지 생성' });
    expect(retest.hasAttribute('disabled')).toBe(true);
    // 잠긴 단추는 pointer-events-none 이라 클릭이 감싼 묶음으로 간다 — jsdom 은 CSS 를 안 따라 묶음을 직접 누른다
    fireEvent.click(retest.parentElement!);
    expect(push).not.toHaveBeenCalled();
  });

  it('띄어쓰기 없는 긴 제목도 칸 안에서 줄을 바꾼다', () => {
    render(<ExamHistoryCard exam={{ ...exam, title: '가'.repeat(80) }} onDelete={vi.fn()} onRetest={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 3 }).className).toContain('[overflow-wrap:anywhere]');
  });
});
