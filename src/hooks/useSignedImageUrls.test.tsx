import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const sign = vi.fn<(paths: string[]) => Promise<Map<string, string>>>();
vi.mock('@/lib/problem-bank/storage', () => ({ signProblemFiles: (paths: string[]) => sign(paths) }));

const { useSignedImageUrls } = await import('./useSignedImageUrls');

beforeEach(() => {
  sign.mockReset();
  sign.mockImplementation(async (paths) => new Map(paths.map((p) => [p, `https://signed/${p}`])));
});

describe('useSignedImageUrls', () => {
  it('바라는 경로의 서명 URL 을 돌려준다', async () => {
    const { result } = renderHook(() => useSignedImageUrls(['a.jpg', 'b.jpg']));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect([...result.current.urls.keys()].sort()).toEqual(['a.jpg', 'b.jpg']);
    expect(result.current.missing).toEqual([]);
  });

  it('바라는 경로가 줄면 옛 URL 을 내주지 않는다 — 비면 빈 지도다', async () => {
    const { result, rerender } = renderHook(({ paths }) => useSignedImageUrls(paths), {
      initialProps: { paths: ['a.jpg', 'b.jpg'] },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender({ paths: ['a.jpg'] });
    expect([...result.current.urls.keys()]).toEqual(['a.jpg']);

    rerender({ paths: [] });
    expect(result.current.urls.size).toBe(0);
    expect(result.current.loading).toBe(false);
    expect(result.current.missing).toEqual([]);
  });

  it('바라는 것이 그대로면 같은 지도를 내준다 — 렌더마다 새 지도면 그걸 바라보는 확인이 공연히 다시 돈다', async () => {
    const { result, rerender } = renderHook(({ paths }) => useSignedImageUrls(paths), {
      initialProps: { paths: ['a.jpg'] },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    const first = result.current.urls;
    rerender({ paths: ['a.jpg'] });
    expect(result.current.urls).toBe(first);

    rerender({ paths: [] });
    const empty = result.current.urls;
    rerender({ paths: [] });
    expect(result.current.urls).toBe(empty);
  });
});
