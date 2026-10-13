import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { DEFAULT_SIMPLE_COVER, type PaperCover } from '@/lib/problem-paper/cover';
import { COVER_FONT_SPECS, COVER_FONTS_TIMEOUT_MS } from '@/lib/problem-paper/cover-fonts';
import { useCoverFontsReady } from './useCoverFontsReady';

const DESIGN: PaperCover = { ...DEFAULT_SIMPLE_COVER, layout: 'rings', title: '현대시 읽기' };

function stubFonts(load: ((spec: string, text?: string) => Promise<FontFace[]>) | undefined) {
  Object.defineProperty(document, 'fonts', { configurable: true, value: load ? { load } : undefined });
}

afterEach(() => {
  Reflect.deleteProperty(document, 'fonts');
  vi.useRealTimers();
});

describe('useCoverFontsReady', () => {
  it('글꼴 API 가 없으면 기다리지 않는다', () => {
    stubFonts(undefined);
    const { result } = renderHook(() => useCoverFontsReady(DESIGN, '문제지', '2026'));
    expect(result.current).toBe(true);
  });

  it('표지가 없거나 간단·그림 표지면 받지 않는다', () => {
    const load = vi.fn().mockResolvedValue([]);
    stubFonts(load);
    const { result, rerender } = renderHook(
      ({ cover }: { cover: PaperCover | null }) => useCoverFontsReady(cover, '문제지', '2026'),
      { initialProps: { cover: null as PaperCover | null } },
    );
    expect(result.current).toBe(true);
    rerender({ cover: DEFAULT_SIMPLE_COVER });
    expect(result.current).toBe(true);
    rerender({ cover: { ...DESIGN, kind: 'image', imagePath: 'x' } });
    expect(result.current).toBe(true);
    expect(load).not.toHaveBeenCalled();
  });

  it('디자인 표지면 표지 글자로 글꼴마다 조각을 받고, 받으면 연다', async () => {
    let finish: () => void = () => {};
    const gate = new Promise<void>((resolve) => { finish = resolve; });
    const load = vi.fn<(spec: string, text?: string) => Promise<FontFace[]>>(() => gate.then(() => []));
    stubFonts(load);
    const { result } = renderHook(() => useCoverFontsReady(DESIGN, '상현중 기출', '2026'));
    expect(result.current).toBe(false);
    await waitFor(() => expect(load).toHaveBeenCalledTimes(COVER_FONT_SPECS.length));
    const sample = load.mock.calls[0][1] ?? '';
    for (const text of ['현대시 읽기', '상현중 기출', '교사용', '답지', '2026', '아라국어논술']) {
      expect(sample).toContain(text);
    }
    await act(async () => { finish(); });
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('받기가 실패해도 연다(fail-open)', async () => {
    stubFonts(vi.fn().mockRejectedValue(new Error('network')));
    const { result } = renderHook(() => useCoverFontsReady(DESIGN, '문제지', '2026'));
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('끝내 안 오면 시간 상한에서 연다', async () => {
    vi.useFakeTimers();
    stubFonts(vi.fn(() => new Promise<FontFace[]>(() => {})));
    const { result } = renderHook(() => useCoverFontsReady(DESIGN, '문제지', '2026'));
    expect(result.current).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(COVER_FONTS_TIMEOUT_MS); });
    expect(result.current).toBe(true);
  });
});
