import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { DEFAULT_SIMPLE_COVER } from '@/lib/problem-paper/cover';

const fetchPaperCover = vi.fn();
const savePaperCover = vi.fn();
const removePaperCover = vi.fn();
const uploadPaperCoverImage = vi.fn();

vi.mock('@/lib/problem-paper/cover-queries', () => ({
  fetchPaperCover: (...args: unknown[]) => fetchPaperCover(...args),
  savePaperCover: (...args: unknown[]) => savePaperCover(...args),
  removePaperCover: (...args: unknown[]) => removePaperCover(...args),
  uploadPaperCoverImage: (...args: unknown[]) => uploadPaperCoverImage(...args),
}));
vi.mock('@/lib/problem-paper/cover-image', () => ({
  encodeCoverJpeg: vi.fn(async (file: File) => new Blob([file.name], { type: 'image/jpeg' })),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { usePaperCover } from './usePaperCover';

describe('usePaperCover', () => {
  beforeEach(() => {
    fetchPaperCover.mockReset();
    savePaperCover.mockReset();
    removePaperCover.mockReset();
    uploadPaperCoverImage.mockReset();
  });

  it('읽는 동안은 loading, 다 읽으면 표지를 준다', async () => {
    fetchPaperCover.mockResolvedValue(DEFAULT_SIMPLE_COVER);
    const { result } = renderHook(() => usePaperCover('p1'));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.cover).toEqual(DEFAULT_SIMPLE_COVER);
    expect(result.current.failed).toBe(false);
  });

  it("읽기에 실패하면 '표지 없음' 이 아니라 failed 다 — 다시 읽어 성공하면 풀린다", async () => {
    fetchPaperCover.mockRejectedValueOnce(new Error('network'));
    const { result } = renderHook(() => usePaperCover('p1'));
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.loading).toBe(false);
    expect(result.current.cover).toBeNull();

    fetchPaperCover.mockResolvedValueOnce(DEFAULT_SIMPLE_COVER);
    act(() => result.current.reload());
    expect(result.current.loading).toBe(true);
    // ⚠️ 다시 읽는 동안에도 failed 는 false 다(로딩 중) — 로딩이 끝나기를 기다려야 결과를 본다
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.failed).toBe(false);
    expect(result.current.cover).toEqual(DEFAULT_SIMPLE_COVER);
  });

  it('저장하면 서버가 돌려준 표지로 바뀌고, 읽기 실패 표시도 풀린다', async () => {
    fetchPaperCover.mockRejectedValueOnce(new Error('network'));
    const saved = { ...DEFAULT_SIMPLE_COVER, title: '여름 특강' };
    savePaperCover.mockResolvedValue(saved);
    const { result } = renderHook(() => usePaperCover('p1'));
    await waitFor(() => expect(result.current.failed).toBe(true));
    await act(async () => { await result.current.save(saved); });
    expect(result.current.cover).toEqual(saved);
    expect(result.current.failed).toBe(false);
  });

  it('문제지 id 가 없으면 기다리지 않는다(영영 로딩이 아니다)', () => {
    const { result } = renderHook(() => usePaperCover(''));
    expect(result.current.loading).toBe(false);
    expect(fetchPaperCover).not.toHaveBeenCalled();
  });

  it('그림 표지인데 그림도 경로도 없으면 저장하지 않는다', async () => {
    fetchPaperCover.mockResolvedValue(null);
    const { result } = renderHook(() => usePaperCover('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    let ok = true;
    await act(async () => { ok = await result.current.save({ ...DEFAULT_SIMPLE_COVER, kind: 'image' }); });
    expect(ok).toBe(false);
    expect(savePaperCover).not.toHaveBeenCalled();
  });

  it('그림 뒷표지인데 그림도 경로도 없으면 아무것도 올리지 않고 멈춘다 — 앞 그림이 고아가 되지 않게', async () => {
    fetchPaperCover.mockResolvedValue(null);
    const { result } = renderHook(() => usePaperCover('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    let ok = true;
    await act(async () => {
      ok = await result.current.save(
        { ...DEFAULT_SIMPLE_COVER, kind: 'image', backKind: 'image' },
        { front: new File(['a'], 'front.png', { type: 'image/png' }) },
      );
    });
    expect(ok).toBe(false);
    expect(uploadPaperCoverImage).not.toHaveBeenCalled();
    expect(savePaperCover).not.toHaveBeenCalled();
  });

  it('앞·뒤 그림을 차례로 올리고 그 경로로 저장한다', async () => {
    fetchPaperCover.mockResolvedValue(null);
    uploadPaperCoverImage.mockResolvedValueOnce('papers/p1/cover-front.jpg').mockResolvedValueOnce('papers/p1/cover-back.jpg');
    savePaperCover.mockImplementation(async (_id: string, cover: unknown) => cover);
    const { result } = renderHook(() => usePaperCover('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.save(
        { ...DEFAULT_SIMPLE_COVER, kind: 'image', backKind: 'image' },
        {
          front: new File(['a'], 'front.png', { type: 'image/png' }),
          back: new File(['b'], 'back.png', { type: 'image/png' }),
        },
      );
    });
    expect(uploadPaperCoverImage).toHaveBeenCalledTimes(2);
    expect(savePaperCover.mock.calls[0][1]).toMatchObject({
      imagePath: 'papers/p1/cover-front.jpg', backImagePath: 'papers/p1/cover-back.jpg',
    });
  });

  it('뒷표지 그림만 새로 고르면 앞표지 경로는 그대로 두고 뒤만 올린다', async () => {
    fetchPaperCover.mockResolvedValue(null);
    uploadPaperCoverImage.mockResolvedValueOnce('papers/p1/cover-back.jpg');
    savePaperCover.mockImplementation(async (_id: string, cover: unknown) => cover);
    const { result } = renderHook(() => usePaperCover('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.save(
        { ...DEFAULT_SIMPLE_COVER, layout: 'rings', backKind: 'image' },
        { back: new File(['b'], 'back.png', { type: 'image/png' }) },
      );
    });
    expect(uploadPaperCoverImage).toHaveBeenCalledTimes(1);
    expect(savePaperCover.mock.calls[0][1]).toMatchObject({ imagePath: '', backImagePath: 'papers/p1/cover-back.jpg' });
  });
});
