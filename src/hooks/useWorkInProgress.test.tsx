import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { hasWorkInProgress } from '@/lib/work-in-progress';
import { useWorkInProgress } from './useWorkInProgress';

describe('useWorkInProgress', () => {
  it('켜진 동안만 표시가 있고 화면을 떠나면 꺼진다', () => {
    const view = renderHook(({ on }) => useWorkInProgress(on), { initialProps: { on: false } });
    expect(hasWorkInProgress()).toBe(false);
    view.rerender({ on: true });
    expect(hasWorkInProgress()).toBe(true);
    view.rerender({ on: false });
    expect(hasWorkInProgress()).toBe(false);
    view.rerender({ on: true });
    view.unmount();
    expect(hasWorkInProgress()).toBe(false);
  });
});
