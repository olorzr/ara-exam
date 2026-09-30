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
});
