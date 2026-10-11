import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDebouncedValue } from './useDebouncedValue';

afterEach(() => {
  vi.useRealTimers();
});

describe('useDebouncedValue', () => {
  it('처음에는 값 그대로다', () => {
    const { result } = renderHook(() => useDebouncedValue('봄', 300));
    expect(result.current).toBe('봄');
  });

  it('멈춘 뒤에야 따라오고, 그 사이 바뀐 값은 건너뛴다', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 300), { initialProps: { v: '' } });

    rerender({ v: '사' });
    act(() => { vi.advanceTimersByTime(200); });
    rerender({ v: '사미' });
    act(() => { vi.advanceTimersByTime(200); });
    // 마지막으로 바뀐 지 200ms — 아직이다
    expect(result.current).toBe('');

    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe('사미');
  });
});
