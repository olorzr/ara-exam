import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useLazyLoad } from './useLazyLoad';

describe('useLazyLoad', () => {
  it('부르기 전에는 읽지 않는다 — 창을 열지 않고 끝나는 화면이 대부분이다', () => {
    const loader = vi.fn().mockResolvedValue(['봄봄']);
    const { result } = renderHook(() => useLazyLoad(loader));
    expect(loader).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });

  it('여러 번 불러도 한 번만 읽는다', async () => {
    const loader = vi.fn().mockResolvedValue(['봄봄']);
    const { result } = renderHook(() => useLazyLoad(loader));
    act(() => { result.current.ensureLoaded(); result.current.ensureLoaded(); });
    await waitFor(() => expect(result.current.data).toEqual(['봄봄']));
    act(() => result.current.ensureLoaded());
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('실패하면 알리고, 다시 부르면 다시 읽는다', async () => {
    const loader = vi.fn().mockRejectedValueOnce(new Error('네트워크')).mockResolvedValue(['봄봄']);
    const { result } = renderHook(() => useLazyLoad(loader));
    act(() => result.current.ensureLoaded());
    await waitFor(() => expect(result.current.failed).toBe(true));

    act(() => result.current.ensureLoaded());
    await waitFor(() => expect(result.current.data).toEqual(['봄봄']));
    expect(result.current.failed).toBe(false);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
