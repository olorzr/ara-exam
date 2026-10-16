import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ProblemSource } from '@/types/problem-bank';

/**
 * 지문 이어 읽기의 잠금·취소 (2026-10-15 리뷰 8번).
 *
 * 실제 AI 는 부르지 않는다 — 킬스위치·서명·읽기를 손으로 풀 수 있는 약속으로 갈아 끼운다.
 */

const ocrStillEnabled = vi.fn();
const signProblemFile = vi.fn();
const readPassageContinuation = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock('@/lib/ai/still-enabled', () => ({
  ocrStillEnabled: (...a: unknown[]) => ocrStillEnabled(...a),
}));
vi.mock('@/lib/problem-bank/storage', () => ({
  signProblemFile: (...a: unknown[]) => signProblemFile(...a),
}));
vi.mock('@/lib/problem-ocr/continue-passage', () => ({
  readPassageContinuation: (...a: unknown[]) => readPassageContinuation(...a),
}));
vi.mock('@/lib/ai/localModelPref', () => ({ getCodexModelPref: () => ({ model: null, effort: null }) }));
vi.mock('@/lib/ai/localPort', () => ({ getCodexPort: () => 8899 }));
vi.mock('sonner', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

const { usePassageContinuation } = await import('./usePassageContinuation');

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

const SOURCE = { id: 'src-1', file_path: 'synthetic/source.pdf' } as ProblemSource;
const READ = { html: '<p>이어지는 글</p>', continues: false, hasFigure: false, warnings: [] };

beforeEach(() => {
  ocrStillEnabled.mockReset().mockResolvedValue(true);
  signProblemFile.mockReset().mockResolvedValue('https://synthetic/source.pdf');
  readPassageContinuation.mockReset().mockResolvedValue(READ);
  toastSuccess.mockReset();
  toastError.mockReset();
});

describe('usePassageContinuation — 잠금', () => {
  it('⚠️ 킬스위치를 묻는 사이 두 번 눌러도 AI 는 한 번만 돈다', async () => {
    const allowed = deferred<boolean>();
    ocrStillEnabled.mockReturnValue(allowed.promise);
    const { result } = renderHook(() => usePassageContinuation(SOURCE));

    let first!: Promise<unknown>;
    let second!: Promise<unknown>;
    act(() => {
      first = result.current.read('p1', 2, '<p>앞</p>');
      second = result.current.read('p1', 2, '<p>앞</p>');
    });
    expect(result.current.busyId).toBe('p1');
    await act(async () => { allowed.resolve(true); await Promise.all([first, second]); });

    expect(readPassageContinuation).toHaveBeenCalledTimes(1);
    await expect(first).resolves.toEqual(READ);
    await expect(second).resolves.toBeNull();
    expect(result.current.busyId).toBeNull();
  });

  it('⚠️ PDF 를 서명하는 사이 두 번 눌러도 한 번만 돈다', async () => {
    const signed = deferred<string | null>();
    signProblemFile.mockReturnValue(signed.promise);
    const { result } = renderHook(() => usePassageContinuation(SOURCE));

    let first!: Promise<unknown>;
    let second!: Promise<unknown>;
    act(() => {
      first = result.current.read('p1', 2, '');
      second = result.current.read('p1', 2, '');
    });
    await act(async () => { signed.resolve('https://synthetic/source.pdf'); await Promise.all([first, second]); });
    expect(readPassageContinuation).toHaveBeenCalledTimes(1);
  });

  it('킬스위치 확인에도 취소 신호를 싣는다', async () => {
    const { result } = renderHook(() => usePassageContinuation(SOURCE));
    await act(async () => { await result.current.read('p1', 2, ''); });
    expect(ocrStillEnabled).toHaveBeenCalledWith('problem_ocr', expect.any(AbortSignal));
  });
});

describe('usePassageContinuation — 취소', () => {
  it('준비(서명) 중에 취소하면 AI 를 부르지 않고 잠금이 바로 풀린다', async () => {
    const signed = deferred<string | null>();
    signProblemFile.mockReturnValue(signed.promise);
    const { result } = renderHook(() => usePassageContinuation(SOURCE));

    let job!: Promise<unknown>;
    act(() => { job = result.current.read('p1', 2, ''); });
    act(() => result.current.cancel());
    expect(result.current.busyId).toBeNull();

    await act(async () => { signed.resolve('https://synthetic/source.pdf'); await job; });
    await expect(job).resolves.toBeNull();
    expect(readPassageContinuation).not.toHaveBeenCalled();
  });

  it('⚠️ 생성 중에 화면을 떠나면 AI 에 넘긴 신호가 끊긴다', async () => {
    const ai = deferred<typeof READ>();
    readPassageContinuation.mockReturnValue(ai.promise);
    const { result, unmount } = renderHook(() => usePassageContinuation(SOURCE));

    let job!: Promise<unknown>;
    act(() => { job = result.current.read('p1', 2, ''); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(readPassageContinuation).toHaveBeenCalledTimes(1);
    const { signal } = readPassageContinuation.mock.calls[0][0] as { signal: AbortSignal };

    unmount();
    expect(signal.aborted).toBe(true);

    await act(async () => { ai.resolve(READ); await job; });
    await expect(job).resolves.toBeNull();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('⚠️ 취소한 뒤 늦게 온 결과는 본문에 붙지 않고 성공 알림도 없다', async () => {
    const ai = deferred<typeof READ>();
    readPassageContinuation.mockReturnValue(ai.promise);
    const { result } = renderHook(() => usePassageContinuation(SOURCE));

    let job!: Promise<unknown>;
    act(() => { job = result.current.read('p1', 2, ''); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    act(() => result.current.cancel());
    await act(async () => { ai.resolve(READ); await job; });

    await expect(job).resolves.toBeNull();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('⚠️ 취소 뒤 새로 시작한 읽기를 옛 실행의 정리가 풀지 않는다', async () => {
    const oldAi = deferred<typeof READ>();
    const newAi = deferred<typeof READ>();
    readPassageContinuation.mockReturnValueOnce(oldAi.promise).mockReturnValueOnce(newAi.promise);
    const { result } = renderHook(() => usePassageContinuation(SOURCE));

    let oldJob!: Promise<unknown>;
    act(() => { oldJob = result.current.read('p1', 2, ''); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    act(() => result.current.cancel());

    let newJob!: Promise<unknown>;
    act(() => { newJob = result.current.read('p2', 3, ''); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    // 옛 실행이 늦게 끝나도 새 실행의 잠금·표시는 그대로다
    await act(async () => { oldAi.resolve(READ); await oldJob; });
    expect(result.current.busyId).toBe('p2');
    // 그 사이 또 눌러도 통과하지 못한다
    let extra!: Promise<unknown>;
    act(() => { extra = result.current.read('p2', 3, ''); });
    await expect(extra).resolves.toBeNull();

    await act(async () => { newAi.resolve(READ); await newJob; });
    await expect(newJob).resolves.toEqual(READ);
    expect(readPassageContinuation).toHaveBeenCalledTimes(2);
    expect(result.current.busyId).toBeNull();
  });

  it('출처가 바뀌면 옛 출처로 읽던 것을 끊는다', async () => {
    const ai = deferred<typeof READ>();
    readPassageContinuation.mockReturnValue(ai.promise);
    const { result, rerender } = renderHook(
      ({ source }) => usePassageContinuation(source),
      { initialProps: { source: SOURCE } },
    );

    let job!: Promise<unknown>;
    act(() => { job = result.current.read('p1', 2, ''); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const { signal } = readPassageContinuation.mock.calls[0][0] as { signal: AbortSignal };

    rerender({ source: { ...SOURCE, id: 'src-2' } });
    expect(signal.aborted).toBe(true);
    await act(async () => { ai.resolve(READ); await job; });
    await expect(job).resolves.toBeNull();
  });
});
