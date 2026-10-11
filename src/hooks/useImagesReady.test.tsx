import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useImagesReady } from './useImagesReady';

/** src 가 'bad' 로 시작하면 실패, 나머지는 성공하는 가짜 이미지 */
class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(value: string) {
    queueMicrotask(() => (value.startsWith('bad') ? this.onerror?.() : this.onload?.()));
  }
}

const original = window.Image;
beforeEach(() => { (window as unknown as { Image: unknown }).Image = FakeImage; });
afterEach(() => { (window as unknown as { Image: unknown }).Image = original; });

describe('useImagesReady', () => {
  it('못 받은 그림을 알려 준다', async () => {
    const { result } = renderHook(() => useImagesReady(['ok-1', 'bad-1']));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.failed).toEqual(['bad-1']);
  });

  it('확인할 그림이 사라지면 옛 실패를 내주지 않는다 — 인쇄 단추가 영영 잠기면 안 된다', async () => {
    const { result, rerender } = renderHook(({ urls }) => useImagesReady(urls), {
      initialProps: { urls: ['bad-1'] },
    });
    await waitFor(() => expect(result.current.failed).toEqual(['bad-1']));

    rerender({ urls: [] });
    expect(result.current.loading).toBe(false);
    expect(result.current.failed).toEqual([]);
  });

  it('묶음이 바뀌면 새 확인이 끝날 때까지 읽는 중이고 옛 실패는 보이지 않는다', async () => {
    const { result, rerender } = renderHook(({ urls }) => useImagesReady(urls), {
      initialProps: { urls: ['bad-1', 'ok-1'] },
    });
    await waitFor(() => expect(result.current.failed).toEqual(['bad-1']));

    rerender({ urls: ['ok-1'] });
    expect(result.current.loading).toBe(true);
    expect(result.current.failed).toEqual([]);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.failed).toEqual([]);
  });
});
