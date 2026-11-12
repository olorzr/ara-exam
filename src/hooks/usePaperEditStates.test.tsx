import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const fetchPaperEditStates = vi.fn();
vi.mock('@/lib/problem-paper/paper-edit', () => ({
  fetchPaperEditStates: (...a: unknown[]) => fetchPaperEditStates(...a),
}));

const { usePaperEditStates } = await import('./usePaperEditStates');

const pending = { reason: null, inBook: false, pending: true };
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

// ⚠️ 중괄호를 빼지 말 것 — mockReset() 은 흉내 함수를 돌려주고, beforeEach 가 돌려준 함수는 뒷정리로 불린다
beforeEach(() => { fetchPaperEditStates.mockReset(); });

describe('usePaperEditStates', () => {
  it('빈 목록이면 묻지 않는다', () => {
    const { result } = renderHook(() => usePaperEditStates([]));
    expect(result.current.states.size).toBe(0);
    expect(fetchPaperEditStates).not.toHaveBeenCalled();
  });

  it('같은 목록이면 렌더마다 새 배열이어도 한 번만 묻고, 다시 묻기 열쇠가 바뀌면 다시 묻는다', async () => {
    fetchPaperEditStates.mockResolvedValue(new Map([['p1', pending]]));
    const { result, rerender } = renderHook(({ k }) => usePaperEditStates(['p1', 'p1'], k), { initialProps: { k: 0 } });
    await waitFor(() => expect(result.current.states.get('p1')).toEqual(pending));
    rerender({ k: 0 });
    expect(fetchPaperEditStates).toHaveBeenCalledTimes(1);
    expect(fetchPaperEditStates).toHaveBeenCalledWith(['p1']);
    rerender({ k: 1 });
    await waitFor(() => expect(fetchPaperEditStates).toHaveBeenCalledTimes(2));
  });

  it('처음부터 못 읽으면 빈 지도 + 실패(단추를 안 그리고 확인 실패를 알린다)', async () => {
    fetchPaperEditStates.mockRejectedValue(new Error('x'));
    const { result } = renderHook(() => usePaperEditStates(['p1']));
    await waitFor(() => expect(fetchPaperEditStates).toHaveBeenCalled());
    await flush();
    expect(result.current.states.size).toBe(0);
    expect(result.current.failed).toBe(true);
  });

  it('다시 묻는 동안·실패한 뒤에도 마지막으로 알던 반영 대기 경고를 지킨다', async () => {
    fetchPaperEditStates.mockResolvedValueOnce(new Map([['p1', pending]]));
    const { result, rerender } = renderHook(({ k }) => usePaperEditStates(['p1'], k), { initialProps: { k: 0 } });
    await waitFor(() => expect(result.current.states.get('p1')?.pending).toBe(true));

    let reject: (e: Error) => void = () => {};
    fetchPaperEditStates.mockReturnValueOnce(new Promise((_, rj) => { reject = rj; }));
    rerender({ k: 1 });
    expect(result.current.states.get('p1')?.pending).toBe(true); // 기다리는 동안
    await act(async () => { reject(new Error('끊김')); });
    expect(result.current.states.get('p1')?.pending).toBe(true); // 실패한 뒤
    expect(result.current.failed).toBe(true);
  });
});
