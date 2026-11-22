import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ProblemPaper } from '@/types/problem-bank';
import PaperListRow from './PaperListRow';
import PaperSourceSummary from './PaperSourceSummary';

const paper = {
  id: 'p1', title: '형태소 복합어 단일어', settings: { omr: true }, total_questions: 61, user_id: 'u1',
  source_labels: ['2022 중2 경희여자중학교 2학기 기말', '2022 중2 압구정중학교 1학기 중간', '2025 중1 광희중학교 2학기 기말'],
  created_at: '2026-11-15T06:22:11Z',
} as unknown as ProblemPaper;

describe('PaperSourceSummary', () => {
  it('첫 출처만 보이고 나머지는 단추로 펼치고 접는다', () => {
    render(<PaperSourceSummary labels={paper.source_labels} />);
    const button = screen.getByRole('button', { name: '외 2곳 펼치기' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('2025 중1 광희중학교 2학기 기말')).toBeNull();
    fireEvent.click(button);
    expect(screen.getByRole('button', { name: '외 2곳 접기' }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('2025 중1 광희중학교 2학기 기말')).not.toBeNull();
  });

  it('출처가 하나면 단추 없이 글만, 없으면 아무것도 그리지 않는다', () => {
    const { container, rerender } = render(<PaperSourceSummary labels={['하나']} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.textContent).toBe('하나');
    rerender(<PaperSourceSummary labels={[]} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('PaperListRow', () => {
  it('제목만 링크이고 펼치기 단추는 링크 밖이다', () => {
    render(<ul><PaperListRow paper={paper} n={1} /></ul>);
    const link = screen.getByRole('link', { name: '형태소 복합어 단일어' });
    expect(link.getAttribute('href')).toBe('/problems/papers/p1');
    expect(screen.getByRole('button', { name: '외 2곳 펼치기' }).closest('a')).toBeNull();
    expect(screen.getByText('OMR')).not.toBeNull();
    expect(screen.getByText(/61문항/).textContent).not.toContain('선생님');
  });

  it('만든 선생님 이름을 받으면 적는다', () => {
    render(<ul><PaperListRow paper={paper} n={1} creator="최지은" /></ul>);
    expect(screen.getByText(/최지은 선생님 · 61문항/)).not.toBeNull();
  });

  it('고칠 수 있을 때만 연필, 지울 수 있을 때만 휴지통 — 둘 다 늘 보인다', () => {
    const onRemove = vi.fn();
    const editState = { reason: null, inBook: false, pending: false, workbook: false };
    const { rerender } = render(<ul><PaperListRow paper={paper} n={1} editState={editState} onRemove={onRemove} /></ul>);
    const pencil = screen.getByRole('link', { name: '형태소 복합어 단일어 고치기' });
    expect(pencil.getAttribute('href')).toBe('/problems/papers/p1/edit');
    const trash = screen.getByRole('button', { name: '형태소 복합어 단일어 지우기' });
    expect(trash.className).not.toMatch(/opacity-0|group-hover/);
    fireEvent.click(trash);
    expect(onRemove).toHaveBeenCalled();
    rerender(<ul><PaperListRow paper={paper} n={1} editState={{ ...editState, reason: 'not_owner' as never }} /></ul>);
    expect(screen.queryByRole('link', { name: '형태소 복합어 단일어 고치기' })).toBeNull();
    expect(screen.queryByRole('button', { name: '형태소 복합어 단일어 지우기' })).toBeNull();
  });
});
