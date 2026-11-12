import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const fetchPaperForEdit = vi.fn();
const fetchPaperEditStates = vi.fn();
vi.mock('@/lib/problem-paper/paper-edit', () => ({
  fetchPaperForEdit: (...a: unknown[]) => fetchPaperForEdit(...a),
  fetchPaperEditStates: (...a: unknown[]) => fetchPaperEditStates(...a),
}));

const { usePaperEditLoad } = await import('./usePaperEditLoad');
const data = { paper: { id: 'p1' }, items: [] };

beforeEach(() => {
  fetchPaperForEdit.mockReset();
  fetchPaperEditStates.mockReset();
});

describe('usePaperEditLoad', () => {
  it('문제지와 고치기 상태를 함께 읽는다', async () => {
    fetchPaperForEdit.mockResolvedValue(data);
    fetchPaperEditStates.mockResolvedValue(new Map([['p1', { reason: null, inBook: false, pending: false }]]));
    const { result } = renderHook(() => usePaperEditLoad('p1'));
    expect(result.current.load.status).toBe('loading');
    await waitFor(() => expect(result.current.load.status).toBe('ready'));
    expect(result.current.load).toMatchObject({ data, state: { reason: null } });
  });

  it('상태가 빠지면 고칠 수 있다고 짐작하지 않는다 · 없으면 missing · 실패면 error', async () => {
    fetchPaperForEdit.mockResolvedValueOnce(data);
    fetchPaperEditStates.mockResolvedValue(new Map());
    const { result } = renderHook(() => usePaperEditLoad('p1'));
    await waitFor(() => expect(result.current.load.status).toBe('ready'));
    expect(result.current.load).toMatchObject({ state: { reason: 'grade_check_failed' } });

    fetchPaperForEdit.mockResolvedValueOnce(null);
    act(() => { result.current.reload(); });
    expect(result.current.load.status).toBe('loading');
    await waitFor(() => expect(result.current.load.status).toBe('missing'));

    fetchPaperForEdit.mockRejectedValueOnce(new Error('끊김'));
    act(() => { result.current.reload(); });
    await waitFor(() => expect(result.current.load).toEqual({ status: 'error', message: '끊김' }));
  });

  it('다시 읽을 때마다 버전이 바뀐다(작업 칸을 새로 연다)', async () => {
    fetchPaperForEdit.mockResolvedValue(data);
    fetchPaperEditStates.mockResolvedValue(new Map());
    const { result } = renderHook(() => usePaperEditLoad('p1'));
    const first = result.current.version;
    act(() => { result.current.reload(); });
    expect(result.current.version).not.toBe(first);
  });
});
