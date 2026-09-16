import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const loadReferencePlain = vi.fn();
const fetchReferenceCandidates = vi.fn();
const toastWarning = vi.fn();
const toastError = vi.fn();

vi.mock('@/lib/quiz-references/bodies', () => ({
  loadReferencePlain: (...args: unknown[]) => loadReferencePlain(...args),
}));
vi.mock('@/lib/quiz-references/candidates', () => ({
  fetchReferenceCandidates: (...args: unknown[]) => fetchReferenceCandidates(...args),
}));
vi.mock('sonner', () => ({
  toast: {
    warning: (...args: unknown[]) => toastWarning(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const { useQuizReferences } = await import('./useQuizReferences');

/** 직접 고르기로 붙이는 자료 하나 */
const candidate = (id: string) => ({
  key: `sheet:${id}`, kind: 'sheet' as const, id,
  label: `개념지 · ${id}`, subtitle: '', updatedAt: '2026-09-01T00:00:00Z',
});

/** 손으로 풀고 잠글 수 있는 약속 — 응답 순서를 시험이 정한다 */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  loadReferencePlain.mockReset();
  fetchReferenceCandidates.mockReset();
  toastWarning.mockReset();
  toastError.mockReset();
});

describe('useQuizReferences — 본문 읽기', () => {
  it('붙이면 본문을 읽어 채우고, 그때까지는 만들기를 막는다', async () => {
    loadReferencePlain.mockResolvedValue(new Map([['sheet:a', '본문 가나다']]));
    const { result } = renderHook(() => useQuizReferences());

    act(() => result.current.add(candidate('a')));
    expect(result.current.loading).toBe(true);
    expect(result.current.promptReferences).toEqual([]);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.promptReferences).toEqual([
      { label: '개념지 · a', plain: '본문 가나다' },
    ]);
    expect(result.current.referenceChars).toBe('본문 가나다'.length);
  });

  it('이미 읽는 중인 자료를 다시 묻지 않는다 — 한 자료를 두 번 읽을 이유가 없다', async () => {
    const first = deferred<Map<string, string>>();
    loadReferencePlain.mockReturnValueOnce(first.promise)
      .mockResolvedValue(new Map([['sheet:b', 'B 본문']]));

    const { result } = renderHook(() => useQuizReferences());
    act(() => result.current.add(candidate('a')));
    act(() => result.current.add(candidate('b')));

    // 두 번째 호출에는 **B 만** 실려야 한다
    expect(loadReferencePlain).toHaveBeenCalledTimes(2);
    expect((loadReferencePlain.mock.calls[1][0] as { key: string }[]).map((r) => r.key))
      .toEqual(['sheet:b']);

    await act(async () => { first.resolve(new Map([['sheet:a', 'A 본문']])); });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.promptReferences.map((r) => r.plain)).toEqual(['A 본문', 'B 본문']);
  });

  it('⚠️ 뺐다 다시 붙이면 새로 읽고, 옛 요청의 실패가 그 자료를 지우지 않는다', async () => {
    const stale = deferred<Map<string, string>>();
    loadReferencePlain.mockReturnValueOnce(stale.promise)
      .mockResolvedValue(new Map([['sheet:a', '새로 읽은 본문']]));

    const { result } = renderHook(() => useQuizReferences());
    act(() => result.current.add(candidate('a')));   // 요청 1 시작
    act(() => result.current.remove('sheet:a'));
    act(() => result.current.add(candidate('a')));   // 요청 2 — 반드시 새로 나가야 한다

    expect(loadReferencePlain).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.promptReferences).toEqual([
      { label: '개념지 · a', plain: '새로 읽은 본문' },
    ]);

    // 이제 옛 요청이 실패한다 — 멀쩡히 붙어 있는 자료를 건드리면 안 된다
    await act(async () => {
      stale.reject(new Error('늦게 도착한 실패'));
      await Promise.resolve();
    });
    expect(result.current.attached).toHaveLength(1);
    expect(result.current.promptReferences[0].plain).toBe('새로 읽은 본문');
    expect(toastError).not.toHaveBeenCalled();
  });

  it('뺀 자료의 응답이 늦게 와도 되살리지 않는다', async () => {
    const stale = deferred<Map<string, string>>();
    loadReferencePlain.mockReturnValueOnce(stale.promise);

    const { result } = renderHook(() => useQuizReferences());
    act(() => result.current.add(candidate('a')));
    act(() => result.current.remove('sheet:a'));
    expect(result.current.attached).toHaveLength(0);

    await act(async () => { stale.resolve(new Map([['sheet:a', '본문']])); });
    expect(result.current.attached).toHaveLength(0);
  });

  it('본문을 못 찾은 자료는 뺀다 — 남겨 두면 만들기가 영영 잠긴다', async () => {
    loadReferencePlain.mockResolvedValue(new Map());
    const { result } = renderHook(() => useQuizReferences());

    act(() => result.current.add(candidate('a')));
    await waitFor(() => expect(result.current.attached).toHaveLength(0));
    expect(result.current.loading).toBe(false);
    expect(toastWarning).toHaveBeenCalled();
  });

  it('읽기가 실패하면 그 자료를 빼고 알린다', async () => {
    loadReferencePlain.mockRejectedValue(new Error('망'));
    const { result } = renderHook(() => useQuizReferences());

    act(() => result.current.add(candidate('a')));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(result.current.attached).toHaveLength(0);
    expect(result.current.loading).toBe(false);
  });
});

describe('useQuizReferences — 빼기와 다시 찾기', () => {
  const signals = {
    title: '봄봄', author: '', excludePassageId: null, excludeSheetId: null,
    unitPath: [], textbook: '', grade: '', schoolName: '', year: '',
  };
  /** 자동 찾기가 a 를 고르게 한다 */
  const hitsFor = (id: string, reason: string) => ({
    hits: [{ candidate: candidate(id), hit: { signal: 'title' as const, detail: reason } }],
    failures: 0,
  });

  it('사람이 뺀 자료는 다시 찾아도 안 붙는다 — 되살아나면 몇 번이고 다시 빼게 된다', async () => {
    fetchReferenceCandidates.mockResolvedValue(hitsFor('a', "제목에 '봄봄'"));
    loadReferencePlain.mockResolvedValue(new Map([['sheet:a', '본문']]));

    const { result } = renderHook(() => useQuizReferences());
    await act(async () => { await result.current.suggest(signals); });
    await waitFor(() => expect(result.current.attached).toHaveLength(1));

    act(() => result.current.remove('sheet:a'));
    await act(async () => { await result.current.suggest(signals, { force: true }); });
    expect(result.current.attached).toHaveLength(0);
  });

  it('다시 찾으면 까닭을 새것으로 갈되 읽어 둔 본문은 물려받는다', async () => {
    fetchReferenceCandidates.mockResolvedValueOnce(hitsFor('a', "제목에 '봄봄'"))
      .mockResolvedValueOnce(hitsFor('a', "제목에 '동백꽃'"));
    loadReferencePlain.mockResolvedValue(new Map([['sheet:a', '본문']]));

    const { result } = renderHook(() => useQuizReferences());
    await act(async () => { await result.current.suggest(signals); });
    await waitFor(() => expect(result.current.attached[0].plain).toBe('본문'));

    await act(async () => { await result.current.suggest(signals, { force: true }); });
    expect(result.current.attached[0].reason).toBe("제목에 '동백꽃'");
    // 본문을 다시 읽지 않는다 — 왕복만 는다
    expect(loadReferencePlain).toHaveBeenCalledTimes(1);
    expect(result.current.attached[0].plain).toBe('본문');
  });

  it('⚠️ 찾을 신호가 사라지면 자동 자료를 걷어낸다 — 옛 지문의 자료가 새 지문 근거가 되면 안 된다', async () => {
    fetchReferenceCandidates.mockResolvedValue(hitsFor('a', "제목에 '봄봄'"));
    loadReferencePlain.mockImplementation((refs: { key: string }[]) =>
      Promise.resolve(new Map(refs.map((r) => [r.key, `${r.key} 본문`]))));

    const { result } = renderHook(() => useQuizReferences());
    act(() => result.current.add(candidate('manual')));
    await act(async () => { await result.current.suggest(signals); });
    await waitFor(() => expect(result.current.attached).toHaveLength(2));

    // 제목 없는 지문으로 갈아탔다 — 찾을 신호가 하나도 없다
    const empty = { ...signals, title: '' };
    await act(async () => { await result.current.suggest(empty); });

    // 자동으로 붙었던 것만 빠지고 직접 고른 것은 남는다
    expect(result.current.attached.map((r) => r.key)).toEqual(['sheet:manual']);
    expect(result.current.suggesting).toBe(false);
  });

  it('신호가 없을 때 돌던 찾기의 결과가 뒤늦게 붙지 않는다', async () => {
    const late = deferred<{ hits: unknown[]; failures: number }>();
    fetchReferenceCandidates.mockReturnValue(late.promise);
    loadReferencePlain.mockResolvedValue(new Map([['sheet:a', '본문']]));

    const { result } = renderHook(() => useQuizReferences());
    let running!: Promise<void>;
    act(() => { running = result.current.suggest(signals); });   // 찾기 시작
    await act(async () => { await result.current.suggest({ ...signals, title: '' }); });

    await act(async () => {
      late.resolve(hitsFor('a', "제목에 '봄봄'"));
      await running;
    });
    expect(result.current.attached).toHaveLength(0);
  });

  it('dropAuto 는 자동만 걷어내고 직접 고른 것은 남긴다 — 지문을 갈아치울 때 쓴다', async () => {
    fetchReferenceCandidates.mockResolvedValue(hitsFor('a', "제목에 '봄봄'"));
    loadReferencePlain.mockImplementation((refs: { key: string }[]) =>
      Promise.resolve(new Map(refs.map((r) => [r.key, `${r.key} 본문`]))));

    const { result } = renderHook(() => useQuizReferences());
    act(() => result.current.add(candidate('manual')));
    await act(async () => { await result.current.suggest(signals); });
    await waitFor(() => expect(result.current.attached).toHaveLength(2));

    act(() => result.current.dropAuto());
    expect(result.current.attached.map((r) => r.key)).toEqual(['sheet:manual']);

    // 마지막 신호 기억도 지워 같은 신호로 다시 찾을 수 있어야 한다
    await act(async () => { await result.current.suggest(signals); });
    await waitFor(() => expect(result.current.attached).toHaveLength(2));
  });

  it('직접 고른 자료는 다시 찾아도 그대로 둔다', async () => {
    fetchReferenceCandidates.mockResolvedValue(hitsFor('b', "제목에 '봄봄'"));
    loadReferencePlain.mockImplementation((refs: { key: string }[]) =>
      Promise.resolve(new Map(refs.map((r) => [r.key, `${r.key} 본문`]))));

    const { result } = renderHook(() => useQuizReferences());
    act(() => result.current.add(candidate('manual')));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.suggest(signals, { force: true }); });
    await waitFor(() => expect(result.current.attached).toHaveLength(2));
    const manual = result.current.attached.find((r) => r.key === 'sheet:manual');
    expect(manual?.auto).toBe(false);
    expect(manual?.plain).toBe('sheet:manual 본문');
  });
});
