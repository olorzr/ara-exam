import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PaperEditState } from '@/lib/problem-paper/paper-edit';

let states = new Map<string, PaperEditState>();
let failed = false;
const usePaperEditStates = vi.fn();
vi.mock('@/hooks/usePaperEditStates', () => ({
  usePaperEditStates: (...a: unknown[]) => { usePaperEditStates(...a); return { states, failed }; },
}));

const { default: PaperEditEntry } = await import('./PaperEditEntry');

beforeEach(() => { usePaperEditStates.mockReset(); failed = false; });

describe('PaperEditEntry', () => {
  it('고칠 수 있으면 문제 은행 쪽 수정 주소, 책에 담겼으면(원장) 책 쪽 주소', () => {
    states = new Map([['p1', { reason: null, inBook: false, pending: false, workbook: false }]]);
    const { unmount } = render(<PaperEditEntry paperId="p1" refreshKey={0} omr={false} />);
    expect(screen.getByRole('link', { name: /수정/ }).getAttribute('href')).toBe('/problems/papers/p1/edit');
    unmount();
    states = new Map([['p1', { reason: null, inBook: true, pending: false, workbook: false }]]);
    render(<PaperEditEntry paperId="p1" refreshKey={0} omr={false} />);
    expect(screen.getByRole('link', { name: /수정/ }).getAttribute('href')).toBe('/books/papers/p1/edit');
  });

  it('작성자가 아니면 아무것도 없고, 그 밖의 까닭은 잠긴 표시로', () => {
    states = new Map([['p1', { reason: 'not_owner', inBook: false, pending: false, workbook: false }]]);
    const { container, unmount } = render(<PaperEditEntry paperId="p1" refreshKey={0} omr={false} />);
    expect(container.textContent).toBe('');
    unmount();
    states = new Map([['p1', { reason: 'graded', inBook: false, pending: false, workbook: false }]]);
    render(<PaperEditEntry paperId="p1" refreshKey={0} omr={false} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('채점이 시작돼 수정 잠김')).toBeTruthy();
  });

  it('성적 반영 대기면 누구에게나 경고한다', () => {
    states = new Map([['p1', { reason: 'not_owner', inBook: false, pending: true, workbook: false }]]);
    render(<PaperEditEntry paperId="p1" refreshKey={3} omr />);
    expect(screen.getByRole('alert').textContent).toMatch(/아직 반영되지 않았어요/);
    expect(usePaperEditStates).toHaveBeenCalledWith(['p1'], 3);
  });

  it('상태를 못 읽었으면 OMR 문제지에만 \'확인하지 못했어요\' 를 띄운다', () => {
    states = new Map();
    failed = true;
    const { container, unmount } = render(<PaperEditEntry paperId="p1" refreshKey={0} omr={false} />);
    expect(container.textContent).toBe('');
    unmount();
    render(<PaperEditEntry paperId="p1" refreshKey={0} omr />);
    expect(screen.getByRole('status').textContent).toMatch(/확인하지 못했어요/);
  });

  it('평가문제집 문항이 든 문제지는 책 쪽 고치기 화면으로 연다', () => {
    states = new Map([['p1', { reason: null, inBook: false, pending: false, workbook: true }]]);
    render(<PaperEditEntry paperId="p1" refreshKey={0} omr={false} />);
    expect(screen.getByRole('link', { name: /수정/ }).getAttribute('href')).toBe('/books/papers/p1/edit');
  });
});

