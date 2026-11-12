import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

let load: unknown = { status: 'loading' };
const reload = vi.fn();
const workspace = vi.fn();
vi.mock('@/hooks/usePaperEditLoad', () => ({ usePaperEditLoad: () => ({ load, version: 'p1:0', reload }) }));
vi.mock('@/components/problem-paper/PaperEditWorkspace', () => ({
  default: (props: Record<string, unknown>) => { workspace(props); return <div>작업 칸</div>; },
}));

const { default: PaperEditScreen } = await import('./PaperEditScreen');
const data = { paper: { id: 'p1', title: '문제지' }, items: [] };

beforeEach(() => { workspace.mockReset(); });

describe('PaperEditScreen', () => {
  it('막힌 문제지는 작업 칸을 그리지 않고 까닭만 보인다', () => {
    load = { status: 'ready', data, state: { reason: 'in_book', inBook: true, pending: false } };
    render(<PaperEditScreen paperId="p1" />);
    expect(screen.getByRole('alert').textContent).toMatch(/원장님만 고칠 수 있어요/);
    expect(workspace).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: '문제지로 돌아가기' }).getAttribute('href')).toBe('/problems/papers/p1');
  });

  it('고칠 수 있으면 작업 칸 — 저장 뒤 갈 곳은 보기 화면, 책 쪽이면 넘긴 곳', () => {
    load = { status: 'ready', data, state: { reason: null, inBook: false, pending: false } };
    const { unmount } = render(<PaperEditScreen paperId="p1" />);
    expect(workspace.mock.calls[0][0]).toMatchObject({ doneHref: '/problems/papers/p1', withWorkbook: false, data });
    unmount();
    render(<PaperEditScreen paperId="p1" withWorkbook doneHref="/books/inner/b1" />);
    expect(workspace.mock.calls.at(-1)?.[0]).toMatchObject({ doneHref: '/books/inner/b1', withWorkbook: true });
  });

  it('없거나 못 읽었으면 안내(못 읽었으면 다시 불러오기)', () => {
    load = { status: 'missing' };
    const { unmount } = render(<PaperEditScreen paperId="p1" />);
    expect(screen.getByText(/찾지 못했어요/)).toBeTruthy();
    unmount();
    load = { status: 'error', message: '끊김' };
    render(<PaperEditScreen paperId="p1" />);
    expect(screen.getByText('끊김')).toBeTruthy();
    expect(screen.getByRole('button', { name: '다시 불러오기' })).toBeTruthy();
  });
});
