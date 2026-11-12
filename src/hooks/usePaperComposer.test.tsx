import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
const fetchLivePassageIds = vi.fn();
vi.mock('@/lib/problem-paper/paper-edit', () => ({
  fetchLivePassageIds: (...a: unknown[]) => fetchLivePassageIds(...a),
}));

const { usePaperComposer } = await import('./usePaperComposer');
const { toCanvasItems } = await import('@/lib/problem-paper/edit-items');
const { DEFAULT_PAPER_SETTINGS } = await import('@/lib/problem-paper/settings');

type Row = Parameters<ReturnType<typeof usePaperComposer>['add']>[0];
const row = (id: string, passage_id: string | null = null, extra: Partial<Row> = {}) =>
  ({ id, passage_id, question_type: '객관식', answer: '1', choices: ['a', 'b', 'c', 'd', 'e'], ...extra }) as unknown as Row;

const snapshot = (passageId: string | null, answer = '2') => ({
  passage: passageId ? { id: passageId } : null, question_type: '객관식', answer, choices: ['a', 'b', 'c', 'd', 'e'],
});
const storedItems = [
  { id: 'i1', orderIndex: 0, problemId: 'q1', snapshot: snapshot('X') },
  { id: 'i2', orderIndex: 1, problemId: null, snapshot: snapshot(null) },
] as unknown as Parameters<typeof toCanvasItems>[0];

function seed(omr = false) {
  return {
    items: toCanvasItems(storedItems),
    title: '저장된 제목',
    settings: { ...DEFAULT_PAPER_SETTINGS, omr },
    stored: new Map(storedItems.map((s) => [s.id, s])),
  };
}

describe('usePaperComposer — 만들기', () => {
  it('씨앗이 없으면 빈 캔버스다', () => {
    const { result } = renderHook(() => usePaperComposer());
    expect(result.current.items).toEqual([]);
    expect(result.current.title).toBe('');
  });
});

describe('usePaperComposer — 고치기', () => {
  it('저장된 상태로 연다', () => {
    const s = seed();
    const { result } = renderHook(() => usePaperComposer(s));
    expect(result.current.items).toEqual(s.items);
    expect(result.current.title).toBe('저장된 제목');
    expect(result.current.added.has('q1')).toBe(true);
  });

  it('뺐던 저장 항목을 다시 담으면 새로 굳히지 않고 그 항목(스냅샷 지문 id 포함)을 되살린다', () => {
    const { result } = renderHook(() => usePaperComposer(seed()));
    act(() => { result.current.remove('q1'); });
    // 원본의 지문이 그 뒤 바뀌었어도(Y) 캔버스는 스냅샷의 지문(X)으로 묶는다 — 서버 연속성 검사와 같은 기준
    act(() => { result.current.add(row('q1', 'Y'), 0); });
    expect(result.current.items[0]).toEqual({ problemId: 'q1', passageId: 'X', itemId: 'i1' });
  });

  it('새 문항은 항목 id 없이 담긴다', () => {
    const { result } = renderHook(() => usePaperComposer(seed()));
    act(() => { result.current.add(row('q9')); });
    expect(result.current.items.at(-1)).toEqual({ problemId: 'q9', passageId: null });
  });

  it('OMR 미리보기 — 저장된 자리는 스냅샷, 새 자리는 원본으로 조립한다', () => {
    const { result } = renderHook(() => usePaperComposer(seed(true)));
    act(() => { result.current.add(row('q9', null, { answer: '' } as Partial<Row>)); });
    // 스냅샷 둘은 정답 '2'(통과), 새 문항은 정답 없음(막힘) — 번호는 새 자리(3번)
    expect(result.current.omrPlan?.blockers).toEqual([{ no: 3, reason: 'missing' }]);
  });

  it('처음 상태로 — 캔버스·제목·설정을 되돌리고 도는 담기를 버리게 세대를 올린다', () => {
    const s = seed();
    const { result } = renderHook(() => usePaperComposer(s));
    const before = result.current.clearSeq();
    act(() => {
      result.current.remove('q1');
      result.current.setTitle('바꾼 제목');
      result.current.setSettings({ ...s.settings, columns: 1 });
    });
    act(() => { result.current.reset(); });
    expect(result.current.items).toEqual(s.items);
    expect(result.current.title).toBe('저장된 제목');
    expect(result.current.settings.columns).toBe(s.settings.columns);
    expect(result.current.clearSeq()).toBe(before + 1);
  });

  it('최신 지문으로 — 저장 항목의 지금 지문 id 를 읽어 다시 묶고, 원본이 지워진 항목은 묻지도 바꾸지도 않는다', async () => {
    fetchLivePassageIds.mockResolvedValue(new Map([['q1', 'Y']]));
    const { result } = renderHook(() => usePaperComposer(seed()));
    await act(async () => { await result.current.refreshGroup(0, 1); });
    expect(fetchLivePassageIds).toHaveBeenCalledWith(['q1']);
    expect(result.current.items).toEqual([
      { problemId: 'q1', passageId: 'Y' },
      { problemId: 'item:i2', passageId: null, itemId: 'i2' },
    ]);
  });

  it('최신 지문으로 — 읽는 사이 \'처음 상태로\' 를 눌렀으면 버린다', async () => {
    let resolve: (m: Map<string, string | null>) => void = () => {};
    fetchLivePassageIds.mockReturnValue(new Promise((r) => { resolve = r; }));
    const s = seed();
    const { result } = renderHook(() => usePaperComposer(s));
    let pending: Promise<void> = Promise.resolve();
    act(() => { pending = result.current.refreshGroup(0, 1); });
    expect(result.current.refreshing).toBe(true); // 읽는 동안은 저장이 잠긴다(몸통이 담는 중으로 본다)
    act(() => { result.current.reset(); });
    await act(async () => { resolve(new Map([['q1', 'Y']])); await pending; });
    expect(result.current.items).toEqual(s.items);
    expect(result.current.refreshing).toBe(false);
  });

  it('최신 지문으로 — 지문이 합쳐져 옮겨 갈 묶음에 저장 항목이 있으면 그 묶음도 함께 새로 굳힌다', async () => {
    const items = [
      { id: 'iA', orderIndex: 0, problemId: 'qA', snapshot: snapshot('A') },
      { id: 'iB', orderIndex: 1, problemId: 'qB', snapshot: snapshot('B') },
    ] as unknown as Parameters<typeof toCanvasItems>[0];
    const merged = { items: toCanvasItems(items), title: 't', settings: DEFAULT_PAPER_SETTINGS, stored: new Map(items.map((i) => [i.id, i])) };
    fetchLivePassageIds.mockReset();
    fetchLivePassageIds.mockResolvedValueOnce(new Map([['qA', 'B']])).mockResolvedValueOnce(new Map([['qB', 'B']]));
    const { result } = renderHook(() => usePaperComposer(merged));
    await act(async () => { await result.current.refreshGroup(0, 0); });
    expect(fetchLivePassageIds).toHaveBeenNthCalledWith(2, ['qB']);
    expect(result.current.items.every((i) => i.itemId === undefined && i.passageId === 'B')).toBe(true);
  });

  it('최신 지문으로 — 그사이 원본이 지워진 문항이 있으면 아무것도 바꾸지 않는다(반만 바뀌지 않게)', async () => {
    const items = [
      { id: 'iA', orderIndex: 0, problemId: 'qA', snapshot: snapshot('A') },
      { id: 'iB', orderIndex: 1, problemId: 'qB', snapshot: snapshot('A') },
    ] as unknown as Parameters<typeof toCanvasItems>[0];
    const s = { items: toCanvasItems(items), title: 't', settings: DEFAULT_PAPER_SETTINGS, stored: new Map(items.map((i) => [i.id, i])) };
    fetchLivePassageIds.mockReset();
    fetchLivePassageIds.mockResolvedValueOnce(new Map([['qA', 'A']])); // qB 는 지워졌다
    const { result } = renderHook(() => usePaperComposer(s));
    await act(async () => { await result.current.refreshGroup(0, 1); });
    expect(result.current.items).toEqual(s.items);
  });

  it('최신 지문으로 — 합쳐진 묶음이 사슬처럼 이어져도 끝까지 따라가 모두 새로 굳힌다(A→B→C→D)', async () => {
    const ids = ['A', 'B', 'C', 'D'];
    const items = ids.map((p, i) => ({ id: `i${p}`, orderIndex: i, problemId: `q${p}`, snapshot: snapshot(p) })) as unknown as Parameters<typeof toCanvasItems>[0];
    const s = { items: toCanvasItems(items), title: 't', settings: DEFAULT_PAPER_SETTINGS, stored: new Map(items.map((i) => [i.id, i])) };
    fetchLivePassageIds.mockReset();
    fetchLivePassageIds
      .mockResolvedValueOnce(new Map([['qA', 'B']]))
      .mockResolvedValueOnce(new Map([['qB', 'C']]))
      .mockResolvedValueOnce(new Map([['qC', 'D']]))
      .mockResolvedValueOnce(new Map([['qD', 'D']]));
    const { result } = renderHook(() => usePaperComposer(s));
    await act(async () => { await result.current.refreshGroup(0, 0); });
    expect(fetchLivePassageIds).toHaveBeenCalledTimes(4);
    expect(result.current.items.every((i) => i.itemId === undefined)).toBe(true);
  });

  it('최신 지문으로 — 읽는 사이 그 묶음을 빼면 아무것도 새로 굳히지 않는다(남은 묶음까지 번지지 않게)', async () => {
    const items = [
      { id: 'iA', orderIndex: 0, problemId: 'qA', snapshot: snapshot('A') },
      { id: 'iB', orderIndex: 1, problemId: 'qB', snapshot: snapshot('B') },
    ] as unknown as Parameters<typeof toCanvasItems>[0];
    const s = { items: toCanvasItems(items), title: 't', settings: DEFAULT_PAPER_SETTINGS, stored: new Map(items.map((i) => [i.id, i])) };
    let resolve: (m: Map<string, string | null>) => void = () => {};
    fetchLivePassageIds.mockReset();
    fetchLivePassageIds.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    const { result } = renderHook(() => usePaperComposer(s));
    let pending: Promise<void> = Promise.resolve();
    act(() => { pending = result.current.refreshGroup(0, 0); });
    act(() => { result.current.remove('qA'); });
    await act(async () => { resolve(new Map([['qA', 'B']])); await pending; });
    expect(fetchLivePassageIds).toHaveBeenCalledTimes(1);
    expect(result.current.items).toEqual([{ problemId: 'qB', passageId: 'B', itemId: 'iB' }]);
  });
});

