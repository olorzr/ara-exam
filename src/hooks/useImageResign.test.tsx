import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const signProblemFile = vi.fn<(path: string) => Promise<string | null>>();
vi.mock('@/lib/problem-bank/storage', () => ({ signProblemFile: (path: string) => signProblemFile(path) }));

const { useImageResign } = await import('./useImageResign');

const P = 'p/1.jpg';
const base = new Map([[P, 'https://old/1']]);

async function settle() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

/** 손으로 풀어 주는 약속 */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

describe('useImageResign', () => {
  it('깨지면 그 경로만 한 번 다시 서명하고, 뜨면 기록을 지워 다음 만료에도 다시 돈다', async () => {
    signProblemFile.mockReset().mockResolvedValueOnce('https://new/1').mockResolvedValueOnce('https://newer/1');
    const hook = renderHook(() => useImageResign(base));
    expect(hook.result.current.urlOf(P)).toBe('https://old/1');

    act(() => hook.result.current.onError(P, 'https://old/1'));
    // 서명하는 동안은 그리지 않는다
    expect(hook.result.current.signing.has(P)).toBe(true);
    expect(hook.result.current.showable(P)).toBe(false);
    await settle();
    expect(hook.result.current.urlOf(P)).toBe('https://new/1');
    expect(hook.result.current.showable(P)).toBe(true);

    act(() => hook.result.current.onLoad(P));
    // 한 시간 뒤 또 만료돼도 다시 서명한다
    act(() => hook.result.current.onError(P, 'https://new/1'));
    await settle();
    expect(hook.result.current.urlOf(P)).toBe('https://newer/1');
    expect(signProblemFile).toHaveBeenCalledTimes(2);
  });

  it('다시 서명한 주소도 깨지면 못 불러옴으로 두고, 손으로 다시 불러오면 또 서명한다', async () => {
    signProblemFile.mockReset().mockResolvedValue('https://new/1');
    const hook = renderHook(() => useImageResign(base));
    act(() => hook.result.current.onError(P, 'https://old/1'));
    await settle();
    act(() => hook.result.current.onError(P, 'https://new/1'));
    expect(hook.result.current.broken.has(P)).toBe(true);
    expect(signProblemFile).toHaveBeenCalledTimes(1);

    act(() => hook.result.current.retry(P));
    expect(hook.result.current.broken.has(P)).toBe(false);
    await settle();
    expect(signProblemFile).toHaveBeenCalledTimes(2);
  });

  it('손으로 다시 불러오는 동안 옛 주소의 오류가 와도 새 주소를 받으면 그린다(코덱스 3R 경쟁)', async () => {
    signProblemFile.mockReset().mockResolvedValueOnce(null);
    const hook = renderHook(() => useImageResign(base));
    act(() => hook.result.current.onError(P, 'https://old/1'));
    await settle();
    expect(hook.result.current.broken.has(P)).toBe(true);

    const later = deferred<string | null>();
    signProblemFile.mockReturnValueOnce(later.promise);
    act(() => hook.result.current.retry(P));
    // 서명 중에는 만료된 이미지를 다시 붙이지 않는다
    expect(hook.result.current.showable(P)).toBe(false);
    // 옛 주소의 늦은 오류 — 버린다
    act(() => hook.result.current.onError(P, 'https://old/1'));
    later.resolve('https://fresh/1');
    await settle();
    expect(hook.result.current.broken.has(P)).toBe(false);
    expect(hook.result.current.showable(P)).toBe(true);
    expect(hook.result.current.urlOf(P)).toBe('https://fresh/1');
    // 새 주소가 뜬 뒤에 옛 주소의 오류가 와도 버린다
    act(() => hook.result.current.onError(P, 'https://old/1'));
    expect(hook.result.current.showable(P)).toBe(true);
  });

  it('서명이 실패하면 못 불러옴이다', async () => {
    signProblemFile.mockReset().mockResolvedValue(null);
    const hook = renderHook(() => useImageResign(base));
    act(() => hook.result.current.onError(P, 'https://old/1'));
    await settle();
    expect(hook.result.current.broken.has(P)).toBe(true);
  });
});
