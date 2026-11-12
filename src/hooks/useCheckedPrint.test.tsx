import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCheckedPrint } from './useCheckedPrint';

function deferred() {
  let resolve: (v: boolean) => void = () => {};
  let reject: (e: unknown) => void = () => {};
  const promise = new Promise<boolean>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('useCheckedPrint', () => {
  it('판이 그대로면 기다린 뒤의 지금 값으로 go 를 부른다', async () => {
    const d = deferred();
    const check = vi.fn(() => d.promise);
    const go = vi.fn();
    const { result, rerender } = renderHook(({ blocked }) => useCheckedPrint(check, { blocked }), {
      initialProps: { blocked: false },
    });
    let pending: Promise<void> = Promise.resolve();
    act(() => { pending = result.current.run(go); });
    expect(result.current.checking).toBe(true);
    rerender({ blocked: true }); // 기다리는 사이 잠금이 걸렸다
    await act(async () => { d.resolve(false); await pending; });
    expect(go).toHaveBeenCalledWith({ blocked: true });
    expect(result.current.checking).toBe(false);
  });

  it('판이 바뀌었으면 go 를 부르지 않는다', async () => {
    const go = vi.fn();
    const { result } = renderHook(() => useCheckedPrint(() => Promise.resolve(true), 1));
    await act(async () => { await result.current.run(go); });
    expect(go).not.toHaveBeenCalled();
  });

  it('확인하는 동안 다시 누르면 무시한다(같은 렌더 안이어도)', async () => {
    const d = deferred();
    const check = vi.fn(() => d.promise);
    const go = vi.fn();
    const { result } = renderHook(() => useCheckedPrint(check, 0));
    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.run(go);
      void result.current.run(go);
    });
    await act(async () => { d.resolve(false); await first; });
    expect(check).toHaveBeenCalledTimes(1);
    expect(go).toHaveBeenCalledTimes(1);
  });

  it('확인이 던지면 판단하지 않고 go 를 부른다(조회 실패로 인쇄를 영영 막지 않는다)', async () => {
    const d = deferred();
    const go = vi.fn();
    const { result } = renderHook(() => useCheckedPrint(() => d.promise, 'x'));
    let pending: Promise<void> = Promise.resolve();
    act(() => { pending = result.current.run(go); });
    await act(async () => { d.reject(new Error('net')); await pending; });
    expect(go).toHaveBeenCalledWith('x');
    expect(result.current.checking).toBe(false);
  });
});
