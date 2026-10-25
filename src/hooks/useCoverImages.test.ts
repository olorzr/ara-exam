import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { DEFAULT_SIMPLE_COVER } from '@/lib/problem-paper/cover';

const signed = { urls: new Map<string, string>(), loading: false, missing: [] as string[], reload: vi.fn() };
const ready = { loading: false, failed: [] as string[] };
const signCalls: string[][] = [];

vi.mock('./useSignedImageUrls', () => ({
  useSignedImageUrls: (paths: string[]) => { signCalls.push(paths); return signed; },
}));
vi.mock('./useImagesReady', () => ({ useImagesReady: () => ready }));

import { useCoverImages } from './useCoverImages';

const FRONT = 'papers/p/cover-a.jpg';
const BACK = 'papers/p/cover-b.jpg';

describe('useCoverImages', () => {
  beforeEach(() => {
    signed.urls = new Map([[FRONT, 'https://f'], [BACK, 'https://b']]);
    signed.loading = false;
    signed.missing = [];
    ready.loading = false;
    ready.failed = [];
    signCalls.length = 0;
  });

  it('그림이 없으면 서명할 것도 기다릴 것도 없다', () => {
    const { result } = renderHook(() => useCoverImages({ ...DEFAULT_SIMPLE_COVER, layout: 'rings', backKind: 'design' }));
    expect(signCalls.at(-1)).toEqual([]);
    expect(result.current).toMatchObject({ pending: false, broken: false, frontUrl: undefined, backUrl: undefined });
  });

  it('앞·뒤 그림을 함께 서명하고 각자의 주소를 준다', () => {
    const cover = { ...DEFAULT_SIMPLE_COVER, kind: 'image' as const, imagePath: FRONT, backKind: 'image' as const, backImagePath: BACK };
    const { result } = renderHook(() => useCoverImages(cover));
    expect(signCalls.at(-1)).toEqual([FRONT, BACK]);
    expect(result.current).toMatchObject({ frontUrl: 'https://f', backUrl: 'https://b', pending: false, broken: false });
  });

  it('받는 중이면 pending, 뒷표지 그림만 깨져도 broken', () => {
    const cover = { ...DEFAULT_SIMPLE_COVER, backKind: 'image' as const, backImagePath: BACK };
    ready.loading = true;
    expect(renderHook(() => useCoverImages(cover)).result.current.pending).toBe(true);
    ready.loading = false;
    ready.failed = ['https://b'];
    const { result } = renderHook(() => useCoverImages(cover));
    expect(result.current).toMatchObject({ frontBroken: false, backBroken: true, broken: true });
  });

  it('서명을 못 받은 경로도 깨진 것이다', () => {
    signed.missing = [FRONT];
    const cover = { ...DEFAULT_SIMPLE_COVER, kind: 'image' as const, imagePath: FRONT };
    expect(renderHook(() => useCoverImages(cover)).result.current).toMatchObject({ frontBroken: true, broken: true });
  });
});
