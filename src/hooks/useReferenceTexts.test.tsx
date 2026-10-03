import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const fetchReferenceTextList = vi.fn();
const searchReferenceTexts = vi.fn();
const deleteReferenceText = vi.fn();

vi.mock('@/lib/reference-texts/queries', () => ({
  fetchReferenceTextList: (...a: unknown[]) => fetchReferenceTextList(...a),
  searchReferenceTexts: (...a: unknown[]) => searchReferenceTexts(...a),
}));
vi.mock('@/lib/reference-texts/save', () => ({
  deleteReferenceText: (...a: unknown[]) => deleteReferenceText(...a),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { useReferenceTexts } = await import('./useReferenceTexts');

const row = (id: string, title: string, author = '') => ({
  id, title, author, char_count: 100, units: [], grammar_paths: [], note: '', user_id: 'u',
  updated_by: null, created_at: '2026-09-01', updated_at: '2026-09-01',
});

const unit = { grade: '중2', textbook: '천재(노미숙)', semester: '1학기', unit_path: ['1. 문학'] };

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  fetchReferenceTextList.mockReset().mockResolvedValue([row('1', '봄봄')]);
  searchReferenceTexts.mockReset().mockResolvedValue([]);
  deleteReferenceText.mockReset().mockResolvedValue(undefined);
});
afterEach(() => { vi.useRealTimers(); });

describe('useReferenceTexts', () => {
  it('처음에는 최근 목록을 읽는다', async () => {
    const { result } = renderHook(() => useReferenceTexts());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows.map((r) => r.title)).toEqual(['봄봄']);
    expect(result.current.empty).toBe(false);
  });

  it('⚠️ 검색은 서버가 한다 — 받아 둔 목록에서 거르면 상한 너머의 작품이 없는 것처럼 보인다', async () => {
    searchReferenceTexts.mockImplementation((term: string, field: string) =>
      Promise.resolve(field === 'title' ? [row('9', '동백꽃')] : []));

    const { result } = renderHook(() => useReferenceTexts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setSearch('동백꽃'));
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });

    expect(searchReferenceTexts).toHaveBeenCalledWith('동백꽃', 'title', expect.any(Number), {});
    expect(searchReferenceTexts).toHaveBeenCalledWith('동백꽃', 'author', expect.any(Number), {});
    expect(result.current.rows.map((r) => r.title)).toEqual(['동백꽃']);
  });

  it('글자를 칠 때마다 묻지 않는다 — 멈춘 뒤 한 번만', async () => {
    const { result } = renderHook(() => useReferenceTexts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setSearch('동'));
    act(() => result.current.setSearch('동백'));
    act(() => result.current.setSearch('동백꽃'));
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });

    expect(searchReferenceTexts).toHaveBeenCalledTimes(2); // 제목·지은이 한 벌
  });

  it('제목·지은이 결과를 합치되 제목이 앞선다', async () => {
    searchReferenceTexts.mockImplementation((_t: string, field: string) =>
      Promise.resolve(field === 'title' ? [row('t', '봄봄')] : [row('a', '동백꽃', '김유정'), row('t', '봄봄')]));

    const { result } = renderHook(() => useReferenceTexts());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setSearch('김유정'));
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });

    expect(result.current.rows.map((r) => r.id)).toEqual(['t', 'a']);
  });

  it('검색 결과가 비어도 "아직 안 올림" 이라고 하지 않는다', async () => {
    const { result } = renderHook(() => useReferenceTexts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setSearch('없는작품'));
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });

    expect(result.current.rows).toHaveLength(0);
    expect(result.current.empty).toBe(false);
  });

  it('한 편도 없으면 그렇다고 알린다', async () => {
    fetchReferenceTextList.mockResolvedValue([]);
    const { result } = renderHook(() => useReferenceTexts());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.empty).toBe(true);
  });

  it('지운 뒤에는 보고 있던 조건 그대로 다시 읽는다', async () => {
    searchReferenceTexts.mockResolvedValue([row('9', '동백꽃')]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { result } = renderHook(() => useReferenceTexts());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setSearch('동백꽃'));
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });

    searchReferenceTexts.mockClear();
    let deleted = false;
    await act(async () => { deleted = await result.current.remove(row('9', '동백꽃')); });

    expect(deleted).toBe(true);
    expect(deleteReferenceText).toHaveBeenCalledWith('9');
    // 최근 목록이 아니라 **검색 조건**으로 다시 읽어야 한다
    expect(searchReferenceTexts).toHaveBeenCalled();
  });

  it('지우기를 물리면 지우지 않았다고 알린다 — 트리를 괜히 다시 읽지 않게', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { result } = renderHook(() => useReferenceTexts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let deleted = true;
    await act(async () => { deleted = await result.current.remove(row('1', '봄봄')); });
    expect(deleted).toBe(false);
    expect(deleteReferenceText).not.toHaveBeenCalled();
  });
});

describe('useReferenceTexts — 왼쪽 패널의 축', () => {
  it('트리를 누르면 기다리지 않고 그 축으로 바로 읽는다', async () => {
    const { result } = renderHook(() => useReferenceTexts());
    await waitFor(() => expect(result.current.loading).toBe(false));
    fetchReferenceTextList.mockClear().mockResolvedValue([row('2', '동백꽃')]);

    act(() => result.current.setAxis({ kind: 'unit', unit }));

    await waitFor(() => expect(result.current.rows.map((r) => r.id)).toEqual(['2']));
    expect(fetchReferenceTextList).toHaveBeenCalledWith(expect.any(Number), { unit });
    expect(result.current.axis).toEqual({ kind: 'unit', unit });
  });

  it('검색어와 축이 함께 걸린다', async () => {
    const { result } = renderHook(() => useReferenceTexts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setAxis({ kind: 'work', title: '봄봄' }));
    act(() => result.current.setSearch('김'));
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });

    expect(searchReferenceTexts).toHaveBeenCalledWith('김', 'title', expect.any(Number), { title: '봄봄' });
    expect(searchReferenceTexts).toHaveBeenCalledWith('김', 'author', expect.any(Number), { title: '봄봄' });
  });

  it('⚠️ 기다리던 검색은 축을 바꾸면 한 번만 돈다 — 같은 조건을 두 번 묻지 않는다', async () => {
    const { result } = renderHook(() => useReferenceTexts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setSearch('봄'));
    act(() => result.current.setAxis({ kind: 'unit-none' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });

    // 축을 바꾸며 바로 한 벌(제목·지은이) — 타이머는 지워져 더 돌지 않는다
    expect(searchReferenceTexts).toHaveBeenCalledTimes(2);
    expect(searchReferenceTexts).toHaveBeenCalledWith('봄', 'title', expect.any(Number), { unitsEmpty: true });
  });

  it('축에 걸린 것이 없어도 "아직 안 올림" 이라고 하지 않는다', async () => {
    const { result } = renderHook(() => useReferenceTexts());
    await waitFor(() => expect(result.current.loading).toBe(false));
    fetchReferenceTextList.mockResolvedValue([]);

    act(() => result.current.setAxis({ kind: 'grammar-none' }));
    await waitFor(() => expect(result.current.rows).toHaveLength(0));
    expect(result.current.empty).toBe(false);
  });

  it('지운 뒤에는 지금 축으로 다시 읽는다', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { result } = renderHook(() => useReferenceTexts());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setAxis({ kind: 'work', title: '봄봄' }));
    await waitFor(() => expect(fetchReferenceTextList).toHaveBeenLastCalledWith(expect.any(Number), { title: '봄봄' }));

    fetchReferenceTextList.mockClear();
    await act(async () => { await result.current.remove(row('1', '봄봄')); });
    expect(fetchReferenceTextList).toHaveBeenCalledWith(expect.any(Number), { title: '봄봄' });
  });
});
