import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useFontsReady } from './useFontsReady';

function stubFonts(load: ((spec: string, text?: string) => Promise<FontFace[]>) | undefined) {
  Object.defineProperty(document, 'fonts', { configurable: true, value: load ? { load } : undefined });
}

afterEach(() => {
  Reflect.deleteProperty(document, 'fonts');
});

describe('useFontsReady', () => {
  it('꺼져 있으면 받지 않고 바로 연다', () => {
    const load = vi.fn().mockResolvedValue([]);
    stubFonts(load);
    const { result } = renderHook(() => useFontsReady(['700 1em "Jua"'], '국어', false));
    expect(result.current).toBe(true);
    expect(load).not.toHaveBeenCalled();
  });

  it('지정마다 찍을 글자로 받고, 렌더마다 새 배열이어도 다시 받지 않는다', async () => {
    let finish: () => void = () => {};
    const gate = new Promise<void>((resolve) => { finish = resolve; });
    const load = vi.fn<(spec: string, text?: string) => Promise<FontFace[]>>(() => gate.then(() => []));
    stubFonts(load);
    const { result, rerender } = renderHook(
      () => useFontsReady(['400 1em "Jua"', '700 1em "Gmarket Sans"'], '국어 문학 아라국어논술', true),
    );
    expect(result.current).toBe(false);
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    expect(load.mock.calls.map((c) => c[0])).toEqual(['400 1em "Jua"', '700 1em "Gmarket Sans"']);
    expect(load.mock.calls[0][1]).toBe('국어 문학 아라국어논술');
    rerender();
    await act(async () => { finish(); });
    await waitFor(() => expect(result.current).toBe(true));
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('글자가 바뀌면 다시 잠그고 새 글자로 받는다', async () => {
    const load = vi.fn().mockResolvedValue([]);
    stubFonts(load);
    const { result, rerender } = renderHook(
      ({ text }: { text: string }) => useFontsReady(['400 1em "Jua"'], text, true),
      { initialProps: { text: '국어' } },
    );
    await waitFor(() => expect(result.current).toBe(true));
    rerender({ text: '문학' });
    expect(result.current).toBe(false);
    await waitFor(() => expect(result.current).toBe(true));
    expect(load).toHaveBeenLastCalledWith('400 1em "Jua"', '문학');
  });

  it('받기가 실패해도 연다(fail-open)', async () => {
    stubFonts(vi.fn().mockRejectedValue(new Error('network')));
    const { result } = renderHook(() => useFontsReady(['400 1em "Jua"'], '국어', true));
    await waitFor(() => expect(result.current).toBe(true));
  });
});
