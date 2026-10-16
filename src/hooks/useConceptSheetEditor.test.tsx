import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { BuilderCategory } from '@/components/exam-builder';

/**
 * 개념지 편집기 — 첫 저장 중 이어 친 내용 (2026-10-15 리뷰 4번).
 *
 * 편집기(TipTap) 없이 훅만 돌린다 — 본문은 `setEditorHTML` 로 친다(마킹도 HTML 안의 `<mark>` 다).
 * 합성 저장소의 INSERT 는 손으로 풀 수 있는 약속이다.
 */

const m = vi.hoisted(() => ({
  insert: vi.fn(),
  update: vi.fn(),
  read: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/lib/auth-context', () => {
  const user = { id: 'user' };
  return { useAuth: () => ({ user }) };
});
vi.mock('next/navigation', () => {
  const router = { push: m.push, replace: m.replace };
  return { useRouter: () => router };
});
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ single: () => m.read() }) }),
      insert: (row: unknown) => ({ select: () => ({ single: () => m.insert(row) }) }),
      update: (payload: unknown) => {
        const filters: [string, unknown][] = [];
        const q = {
          eq: (k: string, v: unknown) => { filters.push([k, v]); return q; },
          select: () => ({ maybeSingle: () => m.update(payload, filters) }),
        };
        return q;
      },
    }),
  },
}));
vi.mock('@/lib/concept-grade-sync', () => ({ fireConceptGradeSync: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: (...a: unknown[]) => m.toastError(...a), success: vi.fn() } }));

const { useConceptSheetEditor } = await import('./useConceptSheetEditor');

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

const CATEGORY: BuilderCategory = {
  level: '중등', year: '', grade: '중2', publisher: '합성', semester: '1학기', unit: '1단원', subunit: '', schoolName: '',
};
const LIST = '/exam/builder';
const CREATED = { data: { id: 'created', updated_at: 'v1' }, error: null };

type Editor = ReturnType<typeof useConceptSheetEditor>;

/** 새 개념지에 본문을 친 채로 첫 저장을 걸어 둔다(INSERT 는 아직 안 끝났다) */
function startFirstSave() {
  const saving = deferred<typeof CREATED>();
  m.insert.mockReturnValueOnce(saving.promise);
  const hook = renderHook(({ id }) => useConceptSheetEditor({ sheetId: id, listHref: LIST }), {
    initialProps: { id: 'new' },
  });
  act(() => {
    hook.result.current.handleCategoryChange(CATEGORY);
    hook.result.current.setEditorHTML('<p>sent</p>');
  });
  let job!: Promise<void>;
  act(() => { job = hook.result.current.handleSave(); });
  const finish = async () => {
    await act(async () => { saving.resolve(CREATED); await job; });
  };
  return { ...hook, finish };
}

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.update.mockResolvedValue({ data: { updated_at: 'v2' }, error: null });
});

describe('useConceptSheetEditor — 첫 저장 중 손댄 것', () => {
  const edits: [string, (e: Editor) => void, (e: Editor) => unknown, unknown][] = [
    ['본문', (e) => e.setEditorHTML('<p>sent plus later edit</p>'), (e) => e.editorHTML, '<p>sent plus later edit</p>'],
    ['제목', (e) => e.handleTitleChange('이어 친 제목'), (e) => e.title, '이어 친 제목'],
    ['마킹', (e) => e.setEditorHTML('<p><mark data-concept="">sent</mark></p>'), (e) => e.editorHTML,
      '<p><mark data-concept="">sent</mark></p>'],
    ['합격 기준', (e) => e.setPassPercentage(70), (e) => e.passPercentage, 70],
    ['카테고리', (e) => e.handleCategoryChange({ ...CATEGORY, unit: '2단원' }), (e) => e.category.unit, '2단원'],
  ];

  for (const [name, edit, read, expected] of edits) {
    it(`⚠️ 저장 중 ${name} 수정 — 주소를 옮기지 않고 남기며, 다음 저장이 같은 개념지를 고친 뒤 옮긴다`, async () => {
      const { result, finish } = startFirstSave();
      act(() => edit(result.current));
      await finish();

      expect(m.insert).toHaveBeenCalledTimes(1);
      expect((m.insert.mock.calls[0][0] as { editor_html: string }).editor_html).toBe('<p>sent</p>');
      expect(m.replace).not.toHaveBeenCalled();
      expect(read(result.current)).toEqual(expected);
      expect(result.current.dirty).toBe(true);

      await act(async () => { await result.current.handleSave(); });
      expect(m.insert).toHaveBeenCalledTimes(1);
      expect(m.update).toHaveBeenCalledTimes(1);
      expect(m.update.mock.calls[0][1]).toEqual([['id', 'created'], ['updated_at', 'v1']]);
      expect(result.current.dirty).toBe(false);
      expect(m.replace).toHaveBeenCalledWith('/exam/builder/created');
    });
  }

  it('손댄 것이 없으면 첫 저장 뒤 바로 주소를 옮기고, 같은 화면이면 DB 를 다시 읽지 않는다', async () => {
    const { result, rerender, finish } = startFirstSave();
    await finish();
    expect(m.replace).toHaveBeenCalledWith('/exam/builder/created');
    expect(result.current.dirty).toBe(false);

    rerender({ id: 'created' });
    await act(async () => { await Promise.resolve(); });
    expect(m.read).not.toHaveBeenCalled();
    expect(result.current.editorHTML).toBe('<p>sent</p>');
  });

  it('첫 저장이 실패하면 다시 시도가 INSERT 로 나가고, 성공하면 옮긴다', async () => {
    m.insert.mockResolvedValueOnce({ data: null, error: { message: 'network' } });
    const { result } = renderHook(() => useConceptSheetEditor({ sheetId: 'new', listHref: LIST }));
    act(() => {
      result.current.handleCategoryChange(CATEGORY);
      result.current.setEditorHTML('<p>본문</p>');
    });
    await act(async () => { await result.current.handleSave(); });
    expect(m.toastError).toHaveBeenCalled();
    expect(m.replace).not.toHaveBeenCalled();
    expect(result.current.dirty).toBe(true);

    m.insert.mockResolvedValueOnce(CREATED);
    await act(async () => { await result.current.handleSave(); });
    expect(m.insert).toHaveBeenCalledTimes(2);
    expect(m.update).not.toHaveBeenCalled();
    expect(m.replace).toHaveBeenCalledWith('/exam/builder/created');
  });

  it('⚠️ 첫 저장이 끝나기 전에 다시 눌러도 INSERT 는 하나다', async () => {
    const { result, finish } = startFirstSave();
    await act(async () => { await result.current.handleSave(); });
    await finish();
    expect(m.insert).toHaveBeenCalledTimes(1);
  });
});

describe('useConceptSheetEditor — 저장된 값 기준', () => {
  it('불러온 개념지는 편집기가 다시 그린 본문을 기준으로 삼아 처음에는 고친 것이 없다', async () => {
    m.read.mockResolvedValue({
      data: {
        id: 'sheet-1', title: '개념지', level: '중등', year: '', grade: '중2', publisher: '합성',
        semester: '1학기', unit: '1단원', subunit: '', school_name: '', editor_html: '<p>본문</p>',
        pass_percentage: 80, updated_at: 'v5',
      },
      error: null,
    });
    const { result } = renderHook(() => useConceptSheetEditor({ sheetId: 'sheet-1', listHref: LIST }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    // TipTap 이 같은 내용을 제 모양으로 다시 써서 낸다
    act(() => {
      result.current.handleEditorReady('<p>본문</p><p></p>');
      result.current.setEditorHTML('<p>본문</p><p></p>');
    });
    expect(result.current.dirty).toBe(false);

    act(() => result.current.setEditorHTML('<p>본문 고침</p>'));
    expect(result.current.dirty).toBe(true);
    await act(async () => { await result.current.handleSave(); });
    expect(m.update.mock.calls[0][1]).toEqual([['id', 'sheet-1'], ['updated_at', 'v5']]);
    expect(result.current.dirty).toBe(false);
  });
});
