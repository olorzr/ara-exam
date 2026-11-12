import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const signProblemFile = vi.fn<(path: string) => Promise<string | null>>();
vi.mock('@/lib/problem-bank/storage', () => ({ signProblemFile: (path: string) => signProblemFile(path) }));

const { useImageResign } = await import('./useImageResign');

const base = new Map([['p/1.jpg', 'https://old/1']]);

async function settle() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

describe('useImageResign', () => {
  it('깨지면 그 경로만 한 번 다시 서명하고, 뜨면 기록을 지워 다음 만료에도 다시 돈다', async () => {
    signProblemFile.mockReset().mockResolvedValueOnce('https://new/1').mockResolvedValueOnce('https://newer/1');
    const hook = renderHook(() => useImageResign(base));
    expect(hook.result.current.urlOf('p/1.jpg')).toBe('https://old/1');

    act(() => hook.result.current.onError('p/1.jpg'));
    expect(hook.result.current.pending.has('p/1.jpg')).toBe(true);
    await settle();
    expect(hook.result.current.urlOf('p/1.jpg')).toBe('https://new/1');

    act(() => hook.result.current.onLoad('p/1.jpg'));
    expect(hook.result.current.pending.size).toBe(0);

    // 한 시간 뒤 또 만료돼도 다시 서명한다
    act(() => hook.result.current.onError('p/1.jpg'));
    await settle();
    expect(hook.result.current.urlOf('p/1.jpg')).toBe('https://newer/1');
    expect(signProblemFile).toHaveBeenCalledTimes(2);
  });

  it('다시 서명한 주소도 깨지면 못 불러옴으로 두고, 손으로 다시 불러오면 또 서명한다', async () => {
    signProblemFile.mockReset().mockResolvedValue('https://new/1');
    const hook = renderHook(() => useImageResign(base));
    act(() => hook.result.current.onError('p/1.jpg'));
    await settle();
    act(() => hook.result.current.onError('p/1.jpg'));
    expect(hook.result.current.broken.has('p/1.jpg')).toBe(true);
    expect(signProblemFile).toHaveBeenCalledTimes(1);

    act(() => hook.result.current.retry('p/1.jpg'));
    expect(hook.result.current.broken.has('p/1.jpg')).toBe(false);
    await settle();
    expect(signProblemFile).toHaveBeenCalledTimes(2);
  });

  it('서명이 실패하면 못 불러옴이다', async () => {
    signProblemFile.mockReset().mockResolvedValue(null);
    const hook = renderHook(() => useImageResign(base));
    act(() => hook.result.current.onError('p/1.jpg'));
    await settle();
    expect(hook.result.current.broken.has('p/1.jpg')).toBe(true);
  });
});
