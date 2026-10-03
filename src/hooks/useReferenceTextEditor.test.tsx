import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const insertReferenceText = vi.fn();
const updateReferenceText = vi.fn();
const fetchReferenceText = vi.fn();
const replace = vi.fn();
const push = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push }) }));
vi.mock('@/lib/reference-texts/queries', () => ({
  fetchReferenceText: (...a: unknown[]) => fetchReferenceText(...a),
}));
vi.mock('@/lib/reference-texts/save', () => ({
  insertReferenceText: (...a: unknown[]) => insertReferenceText(...a),
  updateReferenceText: (...a: unknown[]) => updateReferenceText(...a),
}));
vi.mock('sonner', () => ({
  toast: {
    error: (...a: unknown[]) => toastError(...a),
    success: (...a: unknown[]) => toastSuccess(...a),
  },
}));

const { useReferenceTextEditor } = await import('./useReferenceTextEditor');

const opts = { id: 'new', listHref: '/reference-texts' };

/** 손으로 풀 수 있는 약속 — 저장이 도는 동안 글을 치는 상황을 만든다 */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

beforeEach(() => {
  insertReferenceText.mockReset().mockResolvedValue({ id: 'r1', updated_at: 't1' });
  updateReferenceText.mockReset().mockResolvedValue({ updated_at: 't2' });
  fetchReferenceText.mockReset();
  replace.mockReset();
  push.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
});

describe('useReferenceTextEditor — 새로 만들기', () => {
  it('제목과 본문이 있어야 저장할 수 있다', () => {
    const { result } = renderHook(() => useReferenceTextEditor(opts));
    expect(result.current.blocker).toContain('작품 제목');
    act(() => result.current.patch({ title: '봄봄' }));
    expect(result.current.blocker).toContain('본문');
    act(() => result.current.patch({ body: '장인님!' }));
    expect(result.current.blocker).toBeNull();
  });

  it('저장하면 정규화된 값으로 굳고 주소를 옮긴다', async () => {
    const { result } = renderHook(() => useReferenceTextEditor(opts));
    act(() => result.current.patch({ title: ' 봄봄 ', body: '장인님!  \n\n\n\n다음' }));
    await act(async () => { await result.current.save(); });

    expect(insertReferenceText).toHaveBeenCalledWith({
      title: '봄봄', author: '', body: '장인님!\n\n다음', units: [], grammar_paths: [], note: '',
    });
    expect(result.current.draft.title).toBe('봄봄');
    expect(result.current.dirty).toBe(false);
    expect(replace).toHaveBeenCalledWith('/reference-texts/r1');
  });

  it('⚠️ 저장하는 사이 이어 친 글을 덮지 않는다 — 입력칸은 저장 중에도 살아 있다', async () => {
    const saving = deferred<{ id: string; updated_at: string }>();
    insertReferenceText.mockReturnValue(saving.promise);

    const { result } = renderHook(() => useReferenceTextEditor(opts));
    act(() => result.current.patch({ title: '봄봄', body: '첫 문장.' }));
    let running!: Promise<void>;
    act(() => { running = result.current.save(); });

    // 응답을 기다리는 사이 이어 쳤다
    act(() => result.current.patch({ body: '첫 문장. 이어 친 문장.' }));

    await act(async () => {
      saving.resolve({ id: 'r1', updated_at: 't1' });
      await running;
    });

    expect(result.current.draft.body).toBe('첫 문장. 이어 친 문장.');
    // DB 에는 보낸 값만 들어갔으니 '저장하지 않은 내용' 으로 남아야 한다
    expect(result.current.dirty).toBe(true);
  });

  it('⚠️ 저장 중에 손댔으면 주소를 옮기지 않는다 — 옮기면 화면이 새로 그려져 그 글이 사라진다', async () => {
    const saving = deferred<{ id: string; updated_at: string }>();
    insertReferenceText.mockReturnValue(saving.promise);

    const { result } = renderHook(() => useReferenceTextEditor(opts));
    act(() => result.current.patch({ title: '봄봄', body: '첫 문장.' }));
    let running!: Promise<void>;
    act(() => { running = result.current.save(); });
    act(() => result.current.patch({ body: '첫 문장. 이어 친 문장.' }));
    await act(async () => { saving.resolve({ id: 'r1', updated_at: 't1' }); await running; });

    expect(replace).not.toHaveBeenCalled();

    // 다음 저장은 수정으로 나가고, 깨끗해졌으니 그때 주소를 옮긴다
    await act(async () => { await result.current.save(); });
    expect(updateReferenceText).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith('/reference-texts/r1');
  });
});

describe('useReferenceTextEditor — 분류 칸', () => {
  const unit = { grade: '중2', textbook: '천재(노미숙)', semester: '1학기', unit_path: ['1. 문학'] };

  it('저장하면 단원·문법이 다듬어진 값으로 굳고 고친 것이 없어진다', async () => {
    const { result } = renderHook(() => useReferenceTextEditor(opts));
    act(() => result.current.patch({
      title: '봄봄', body: '본문', units: [unit, { ...unit, textbook: '천재 (노미숙)' }],
      grammar_paths: ['단어>품사'], note: ' 교학사 ',
    }));
    await act(async () => { await result.current.save(); });

    expect(insertReferenceText).toHaveBeenCalledWith(expect.objectContaining({
      units: [unit], grammar_paths: ['단어 > 품사'], note: '교학사',
    }));
    expect(result.current.draft.units).toEqual([unit]);
    expect(result.current.draft.grammar_paths).toEqual(['단어 > 품사']);
    expect(result.current.dirty).toBe(false);
  });

  it('⚠️ 저장하는 사이 붙인 단원을 덮지 않는다 — 배열 칸도 칸마다 가린다', async () => {
    const saving = deferred<{ id: string; updated_at: string }>();
    insertReferenceText.mockReturnValue(saving.promise);

    const { result } = renderHook(() => useReferenceTextEditor(opts));
    act(() => result.current.patch({ title: '봄봄', body: '본문', units: [unit] }));
    let running!: Promise<void>;
    act(() => { running = result.current.save(); });

    const second = { ...unit, textbook: '비상(김진수)' };
    act(() => result.current.patch({ units: [unit, second] }));
    await act(async () => { saving.resolve({ id: 'r1', updated_at: 't1' }); await running; });

    expect(result.current.draft.units).toEqual([unit, second]);
    expect(result.current.dirty).toBe(true);
  });
});

describe('useReferenceTextEditor — 고치기', () => {
  const existing = {
    id: 'r1', title: '봄봄', author: '김유정', body: '본문',
    char_count: 2, units: [], grammar_paths: [], note: '', user_id: 'u', updated_by: null,
    created_at: 'c', updated_at: 't0',
  };

  it('불러온 값으로 채우고 처음에는 고친 것이 없다', async () => {
    fetchReferenceText.mockResolvedValue(existing);
    const { result } = renderHook(() => useReferenceTextEditor({ ...opts, id: 'r1' }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.draft).toEqual({
      title: '봄봄', author: '김유정', body: '본문', units: [], grammar_paths: [], note: '',
    });
    expect(result.current.dirty).toBe(false);
  });

  it('남이 먼저 고쳤으면 덮지 않고 알린다', async () => {
    fetchReferenceText.mockResolvedValue(existing);
    updateReferenceText.mockResolvedValue(null);
    const { result } = renderHook(() => useReferenceTextEditor({ ...opts, id: 'r1' }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.patch({ body: '고친 본문' }));
    await act(async () => { await result.current.save(); });

    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('먼저 수정'));
    // 화면 값은 그대로 두어 다시 저장할 수 있게 한다
    expect(result.current.draft.body).toBe('고친 본문');
    expect(result.current.dirty).toBe(true);
  });

  it('없는 전문이면 목록으로 돌려보낸다', async () => {
    fetchReferenceText.mockResolvedValue(null);
    renderHook(() => useReferenceTextEditor({ ...opts, id: 'zzz' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/reference-texts'));
  });
});
