import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ConceptPickResult } from '@/lib/concept-pick';

const runConceptPick = vi.fn();
const conceptPickEmptyNotice = vi.fn();
const ocrStillEnabled = vi.fn();
const toastSuccess = vi.fn();
const toastInfo = vi.fn();
const toastError = vi.fn();

vi.mock('@/lib/concept-pick', () => ({
  runConceptPick: (...args: unknown[]) => runConceptPick(...args),
  conceptPickEmptyNotice: (...args: unknown[]) => conceptPickEmptyNotice(...args),
}));
vi.mock('./useProblemOcr', () => ({
  ocrStillEnabled: (...args: unknown[]) => ocrStillEnabled(...args),
}));
vi.mock('@/lib/ai/localPort', () => ({ getCodexPort: () => 8899 }));
vi.mock('@/lib/ai/localModelPref', () => ({ getCodexModelPref: () => ({ model: null, effort: null }) }));
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    info: (...args: unknown[]) => toastInfo(...args),
    warning: (...args: unknown[]) => toastError(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const { useConceptPick } = await import('./useConceptPick');

/** 검증을 통과한 묶음 하나 */
const chunk = (texts: string[], dropped = 0): ConceptPickResult => ({
  picks: texts.map((text) => ({ text, context: '' })),
  dropped: { notInText: dropped, duplicate: 0, malformed: 0 },
});

/** 손으로 풀고 잠글 수 있는 약속 — '첫 묶음이 오기 전' 을 들여다보려면 필요하다 */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

const setup = (addMarkByText = vi.fn().mockReturnValue(true)) => {
  const editorRef = { current: { getHTML: () => '<p>본문</p>' } as never };
  const removeMarkByText = vi.fn();
  const hook = renderHook(() => useConceptPick({
    editorRef, marks: [], addMarkByText, removeMarkByText,
  }));
  return { hook, addMarkByText, removeMarkByText };
};

beforeEach(() => {
  runConceptPick.mockReset();
  conceptPickEmptyNotice.mockReset()
    .mockReturnValue({ level: 'info', text: '더 추천할 용어가 없어요.' });
  ocrStillEnabled.mockReset().mockResolvedValue(true);
  toastSuccess.mockReset();
  toastInfo.mockReset();
  toastError.mockReset();
});

describe('useConceptPick', () => {
  it('묶음이 올 때마다 그 자리에서 마킹한다 — 다 모아 붙이면 취소가 곧 전부 잃는 일이 된다', async () => {
    runConceptPick.mockImplementation(async (input: { onChunk?: (r: ConceptPickResult, i: number, t: number) => void }) => {
      input.onChunk?.(chunk(['갈래']), 1, 2);
      input.onChunk?.(chunk(['주제']), 2, 2);
      return chunk(['갈래', '주제']);
    });
    const { hook, addMarkByText } = setup();
    await act(async () => { await hook.result.current.run(); });

    expect(addMarkByText.mock.calls.map((c) => c[0])).toEqual(['갈래', '주제']);
    expect(hook.result.current.applied.map((p) => p.text)).toEqual(['갈래', '주제']);
    expect(toastSuccess).toHaveBeenCalledWith('2개를 마킹했어요.');
  });

  it('두 번째 실행은 지난 실행의 버린 수를 물려받지 않는다 (코덱스 리뷰)', async () => {
    runConceptPick.mockImplementation(async (input: { onChunk?: (r: ConceptPickResult, i: number, t: number) => void }) => {
      input.onChunk?.(chunk(['갈래'], 2), 1, 1);
      return chunk(['갈래'], 2);
    });
    const { hook } = setup();
    await act(async () => { await hook.result.current.run(); });
    expect(hook.result.current.dropped?.notInText).toBe(2);

    await act(async () => { await hook.result.current.run(); });
    // 더하면 4가 된다 — 지난 실행의 숫자가 화면에 그대로 남는 것이 이 버그였다
    expect(hook.result.current.dropped?.notInText).toBe(2);
  });

  it('지난 실행의 경고는 **첫 묶음이 오기 전에** 지운다 — 새 실행의 것인 양 떠 있으면 안 된다', async () => {
    runConceptPick.mockImplementation(async (input: { onChunk?: (r: ConceptPickResult, i: number, t: number) => void }) => {
      input.onChunk?.(chunk(['갈래'], 3), 1, 1);
      return chunk(['갈래'], 3);
    });
    const { hook } = setup(vi.fn().mockReturnValue(false));
    await act(async () => { await hook.result.current.run(); });
    expect(hook.result.current.notFound).toEqual(['갈래']);
    expect(hook.result.current.dropped?.notInText).toBe(3);

    // 두 번째 실행은 첫 묶음을 늦게 준다 — 그 사이에 지난번 경고가 남아 있으면 안 된다
    const gate = deferred<ConceptPickResult>();
    runConceptPick.mockImplementation(async (input: { onChunk?: (r: ConceptPickResult, i: number, t: number) => void }) => {
      const result = await gate.promise;
      input.onChunk?.(result, 1, 1);
      return result;
    });
    let pending!: Promise<void>;
    await act(async () => { pending = hook.result.current.run(); });
    expect(hook.result.current.notFound).toEqual([]);
    expect(hook.result.current.dropped).toBeNull();
    await act(async () => { gate.resolve(chunk([])); await pending; });
  });

  it('킬스위치를 기다리는 사이에 한 번 더 눌러도 생성은 하나만 돈다 (코덱스 리뷰 2R)', async () => {
    const gate = deferred<boolean>();
    ocrStillEnabled.mockReturnValue(gate.promise);
    runConceptPick.mockResolvedValue(chunk([]));
    const { hook } = setup();

    let first!: Promise<void>;
    let second!: Promise<void>;
    await act(async () => {
      first = hook.result.current.run();
      second = hook.result.current.run();
    });
    await act(async () => { gate.resolve(true); await Promise.all([first, second]); });

    // 두 번 통과하면 생성이 둘 돌고, 먼저 끝난 쪽이 다른 쪽의 취소 손잡이를 지운다
    expect(runConceptPick).toHaveBeenCalledTimes(1);
    expect(hook.result.current.running).toBe(false);
  });

  it('신호를 안 듣는 기다림에 걸려도 취소로 풀린다 — 안 풀리면 화면이 잠긴 채 남는다 (코덱스 리뷰 3~4R)', async () => {
    // ⚠️ **취소해도 영영 안 풀리는 게이트.** authFetch 안의 세션 조회·갱신이 신호를 받지
    //    않으므로 실제로 이런 모양이 된다 — 신호를 넘기는 것만으로는 모자라고, 기다림 자체가
    //    경주(Promise.race)여야 자리를 놓을 수 있다
    ocrStillEnabled.mockImplementation(() => new Promise<boolean>(() => {}));
    const { hook } = setup();

    let pending!: Promise<void>;
    await act(async () => { pending = hook.result.current.run(); });
    expect(hook.result.current.running).toBe(true);

    await act(async () => { hook.result.current.cancel(); await pending; });
    expect(hook.result.current.running).toBe(false);
    expect(hook.result.current.progress).toBeNull();
    expect(runConceptPick).not.toHaveBeenCalled();
    // 사람이 끊은 것을 '기능이 꺼졌다' 고 말하면 거짓말이다
    expect(toastError).not.toHaveBeenCalled();

    // 자리를 도로 놓았으니 다시 누를 수 있다
    ocrStillEnabled.mockResolvedValue(true);
    runConceptPick.mockResolvedValue(chunk([]));
    await act(async () => { await hook.result.current.run(); });
    expect(runConceptPick).toHaveBeenCalledTimes(1);
  });

  it('기능이 꺼져 있으면 맡아 둔 자리를 도로 놓는다 — 안 놓으면 다시 누를 수 없다', async () => {
    ocrStillEnabled.mockResolvedValue(false);
    const { hook } = setup();
    await act(async () => { await hook.result.current.run(); });
    expect(hook.result.current.running).toBe(false);

    ocrStillEnabled.mockResolvedValue(true);
    runConceptPick.mockResolvedValue(chunk([]));
    await act(async () => { await hook.result.current.run(); });
    expect(runConceptPick).toHaveBeenCalledTimes(1);
  });

  it('취소는 오류가 아니라 어디까지 했는지로 알린다 — 붙인 것은 남는다', async () => {
    const { AiError } = await import('@/lib/ai/types');
    runConceptPick.mockImplementation(async (input: { onChunk?: (r: ConceptPickResult, i: number, t: number) => void }) => {
      input.onChunk?.(chunk(['갈래', '주제']), 1, 3);
      throw new AiError('cancelled');
    });
    const { hook } = setup();
    await act(async () => { await hook.result.current.run(); });

    expect(toastInfo).toHaveBeenCalledWith('2개까지 마킹하고 멈췄어요.');
    expect(toastError).not.toHaveBeenCalled();
    expect(hook.result.current.applied).toHaveLength(2);
  });

  it('기능이 꺼져 있으면 생성을 시작하지 않는다 (fail-closed)', async () => {
    ocrStillEnabled.mockResolvedValue(false);
    const { hook } = setup();
    await act(async () => { await hook.result.current.run(); });

    expect(runConceptPick).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalled();
  });

  it('되돌리기는 AI 가 붙인 것만 뺀다 — 손으로 한 마킹은 건드리지 않는다', async () => {
    runConceptPick.mockImplementation(async (input: { onChunk?: (r: ConceptPickResult, i: number, t: number) => void }) => {
      input.onChunk?.(chunk(['갈래', '주제']), 1, 1);
      return chunk(['갈래', '주제']);
    });
    const { hook, removeMarkByText } = setup();
    await act(async () => { await hook.result.current.run(); });
    act(() => { hook.result.current.undoAll(); });

    expect(removeMarkByText.mock.calls.map((c) => c[0])).toEqual(['갈래', '주제']);
    expect(hook.result.current.applied).toEqual([]);
    expect(hook.result.current.dropped).toBeNull();
  });
});
