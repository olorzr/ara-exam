import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { BOOK_PAGE_COUNT_SETTLE_MS, useBookPageCount } from './useBookPageCount';

type Props = Parameters<typeof useBookPageCount>[0];

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup(initial: Partial<Props> = {}) {
  const save = vi.fn(async () => true);
  const props: Props = { stored: undefined, layoutKey: 'k1', canPersist: true, save, ...initial };
  const hook = renderHook((p: Props) => useBookPageCount(p), { initialProps: props });
  return { hook, save, props };
}

const settle = async () => {
  await act(async () => { vi.advanceTimersByTime(BOOK_PAGE_COUNT_SETTLE_MS + 10); });
};

describe('useBookPageCount', () => {
  it('가라앉은 뒤 마지막 값으로 한 번만 저장한다', async () => {
    const { hook, save } = setup();
    act(() => hook.result.current.onLayout({ pageCount: 12 }));
    act(() => hook.result.current.onLayout({ pageCount: 16 }));
    expect(save).not.toHaveBeenCalled();
    await settle();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ pages: 16, key: 'k1' });
  });

  it('저장값과 같으면 저장하지 않고 상태는 저장됨', async () => {
    const { hook, save } = setup({ stored: { pages: 16, key: 'k1' } });
    act(() => hook.result.current.onLayout({ pageCount: 16 }));
    await settle();
    expect(save).not.toHaveBeenCalled();
    expect(hook.result.current.status).toBe('saved');
  });

  it('저장해도 될 때까지(그림·글꼴) 기다리고, 준비된 뒤 다시 가라앉아야 저장한다', async () => {
    const { hook, save, props } = setup({ canPersist: false });
    act(() => hook.result.current.onLayout({ pageCount: 4 }));
    await settle();
    expect(save).not.toHaveBeenCalled();
    expect(hook.result.current.status).toBe('measuring');
    // 준비가 끝난 그 순간 옛 쪽 수를 바로 저장하지 않는다(코덱스 2R) — 그 사이 그림이 와서 쪽 수가 바뀐다
    hook.rerender({ ...props, canPersist: true });
    await act(async () => {});
    expect(save).not.toHaveBeenCalled();
    act(() => hook.result.current.onLayout({ pageCount: 8 }));
    await settle();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ pages: 8, key: 'k1' });
  });

  it('구성(지문)이 바뀐 직후 옛 구성에서 잰 쪽 수를 새 지문으로 저장하지 않는다', async () => {
    const { hook, save, props } = setup({ canPersist: false });
    act(() => hook.result.current.onLayout({ pageCount: 8 }));
    await settle();
    hook.rerender({ ...props, layoutKey: 'k2', canPersist: true });
    await act(async () => {});
    expect(save).not.toHaveBeenCalled();
    expect(hook.result.current.measured).toBeNull();
  });

  it('저장에 실패한 값은 다시 보내지 않고, 다시 시도하면 보낸다', async () => {
    const save = vi.fn(async () => false);
    const { hook } = setup({ save });
    act(() => hook.result.current.onLayout({ pageCount: 4 }));
    await settle();
    expect(save).toHaveBeenCalledTimes(1);
    expect(hook.result.current.status).toBe('failed');
    await settle();
    expect(save).toHaveBeenCalledTimes(1);
    act(() => hook.result.current.retry());
    await act(async () => {});
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('0쪽(장이 없다)은 쪽 수로 치지 않는다', async () => {
    const { hook, save } = setup();
    act(() => hook.result.current.onLayout({ pageCount: 0 }));
    await settle();
    expect(save).not.toHaveBeenCalled();
    expect(hook.result.current.measured).toBeNull();
  });
});
