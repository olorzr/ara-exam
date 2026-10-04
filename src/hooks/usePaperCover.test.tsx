import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { DEFAULT_SIMPLE_COVER } from '@/lib/problem-paper/cover';

const fetchPaperCover = vi.fn();
const savePaperCover = vi.fn();
const removePaperCover = vi.fn();

vi.mock('@/lib/problem-paper/cover-queries', () => ({
  fetchPaperCover: (...args: unknown[]) => fetchPaperCover(...args),
  savePaperCover: (...args: unknown[]) => savePaperCover(...args),
  removePaperCover: (...args: unknown[]) => removePaperCover(...args),
  uploadPaperCoverImage: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { usePaperCover } from './usePaperCover';

describe('usePaperCover', () => {
  beforeEach(() => {
    fetchPaperCover.mockReset();
    savePaperCover.mockReset();
    removePaperCover.mockReset();
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
});
