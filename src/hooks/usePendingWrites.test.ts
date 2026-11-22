import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePendingWrites } from './usePendingWrites';

describe('usePendingWrites — 도는 쓰기 세기', () => {
  it('약속이 끝날 때까지 세고, 실패해도 센 것을 푼다', async () => {
    const { result } = renderHook(() => usePendingWrites());
    let finish: (v: string) => void = () => undefined;
    let fail: (e: Error) => void = () => undefined;
    const save = result.current.track((x: number) => new Promise<string>((res) => { finish = res; void x; }));
    const remove = result.current.track(() => new Promise<void>((_, rej) => { fail = rej; }));
    let saved: Promise<string> = Promise.resolve('');
    let removed: Promise<void> = Promise.resolve();
    act(() => { saved = save(1); removed = remove().catch(() => undefined); });
    expect(result.current.pending).toBe(2);
    await act(async () => { finish('ok'); await saved; });
    expect(result.current.pending).toBe(1);
    await act(async () => { fail(new Error('x')); await removed; });
    expect(result.current.pending).toBe(0);
  });

  it('약속이 아닌 결과는 세지 않고 그대로 돌려준다', () => {
    const { result } = renderHook(() => usePendingWrites());
    const sync = result.current.track((a: number) => a + 1);
    expect(sync(1)).toBe(2);
    expect(result.current.pending).toBe(0);
  });

  it('감싸기 함수는 늘 같다', () => {
    const { result, rerender } = renderHook(() => usePendingWrites());
    const first = result.current.track;
    rerender();
    expect(result.current.track).toBe(first);
  });
});
