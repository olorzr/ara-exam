import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReviewHeader from './ReviewHeader';
import type { ProblemSource } from '@/types/problem-bank';

// 교과서 칸은 출판사·내신 범위를 조회한다 — 머리의 삭제 단추만 보려고 비워 둔다
vi.mock('./SourceTextbookPicker', () => ({ default: () => null }));

const source = {
  id: 's1', source_type: '내신기출', title: '2026 상현중 중2 1학기 중간', school_name: '상현중',
  school_id: null, year: '2026', grade: '중2', semester: '1학기', exam_type: '중간', publisher: '',
  textbook: '', file_path: '', answer_key_paths: [], page_count: 4, status: '검수중', ocr_meta: {},
  notes: '', user_id: 'u', updated_by: null, created_at: '2026-09-30T00:00:00Z',
  updated_at: '2026-09-30T00:00:00Z',
} as unknown as ProblemSource;

const draw = (props: { onDelete?: () => void; deleting?: boolean } = {}) => render(
  <ReviewHeader source={source} problemCount={23} onTextbook={vi.fn()} {...props} />,
);

describe('ReviewHeader', () => {
  it('지우기를 넘기면(원장) 삭제 단추가 있다', () => {
    draw({ onDelete: vi.fn() });
    const button = screen.getByRole('button', { name: '삭제' }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });

  it('지우기를 안 넘기면(원장이 아니면) 삭제 단추 자체가 없다', () => {
    draw();
    expect(screen.queryByRole('button', { name: /삭제|지우는 중/ })).toBeNull();
  });

  it('지우는 중이면 단추를 잠그고 그렇게 말한다', () => {
    draw({ onDelete: vi.fn(), deleting: true });
    const button = screen.getByRole('button', { name: '지우는 중…' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('세트로 보는 시험지(내신기출·모의고사)면 읽기 전용으로 보기 링크를 낸다 — 평가문제집은 안 낸다(2026-11-22)', () => {
    const { unmount } = draw();
    expect(screen.getByRole('link', { name: '읽기 전용으로 보기' }).getAttribute('href')).toBe('/problems/sets/exam/s1');
    unmount();
    render(<ReviewHeader source={{ ...source, source_type: '평가문제집' } as ProblemSource} problemCount={3} onTextbook={vi.fn()} />);
    expect(screen.queryByRole('link', { name: '읽기 전용으로 보기' })).toBeNull();
  });

  it('저장하지 않은 수정이 있으면 읽기 전용으로 가기 전에 묻고, 취소하면 머문다(코덱스 1R)', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ReviewHeader source={source} problemCount={23} onTextbook={vi.fn()} unsavedCount={2} />);
    const link = screen.getByRole('link', { name: '읽기 전용으로 보기' });
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(click);
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('저장하지 않은 수정이 2개'));
    expect(click.defaultPrevented).toBe(true);
    confirm.mockReturnValue(true);
    const again = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(again);
    expect(again.defaultPrevented).toBe(false);
    confirm.mockRestore();
  });

  it('새 탭으로 열면(보조키) 이 화면이 남으니 묻지 않는다(코덱스 2R)', () => {
    const confirm = vi.spyOn(window, 'confirm');
    render(<ReviewHeader source={source} problemCount={23} onTextbook={vi.fn()} unsavedCount={2} />);
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true });
    screen.getByRole('link', { name: '읽기 전용으로 보기' }).dispatchEvent(click);
    expect(confirm).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('고치던 것이 없으면 묻지 않는다', () => {
    const confirm = vi.spyOn(window, 'confirm');
    draw();
    screen.getByRole('link', { name: '읽기 전용으로 보기' }).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(confirm).not.toHaveBeenCalled();
    confirm.mockRestore();
  });
});
