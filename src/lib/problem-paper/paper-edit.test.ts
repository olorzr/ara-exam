import { beforeEach, describe, expect, it, vi } from 'vitest';

/** 부른 차례를 적는다 — 문제지 행을 **먼저** 다 읽고 나서 항목을 읽어야 한다(낙관적 잠금의 일부) */
const calls: string[] = [];
let resolvePaper: ((value: unknown) => void) | null = null;
let itemResult: { data: unknown; error: unknown } = { data: [], error: null };
const rpc = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    from: (table: string) => {
      calls.push(`from:${table}`);
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => { calls.push('items:read'); return Promise.resolve(itemResult); },
        maybeSingle: () => new Promise((resolve) => { resolvePaper = resolve; }),
      };
      return chain;
    },
  },
}));

const {
  fetchPaperForEdit, fetchPaperEditStates, parsePaperEditStates, paperEditError, paperEditHref, updatePaper,
  PaperEditBlockedError, PaperEditConflictError, PaperMissingError, PAPER_EDIT_STATES_MAX,
} = await import('./paper-edit');

const paperRow = {
  id: 'p1', title: '문제지', settings: { columns: 1 }, total_questions: 1, user_id: 'u1',
  created_at: '2026-11-12T00:00:00Z', updated_at: '2026-11-12T03:04:05.123456+00:00',
};

beforeEach(() => {
  calls.length = 0;
  resolvePaper = null;
  itemResult = { data: [{ id: 'i1', order_index: 0, problem_id: 'q1', snapshot: { stem_html: '' } }], error: null };
  rpc.mockReset();
});

describe('fetchPaperForEdit', () => {
  it('문제지 행을 다 읽은 **뒤에** 항목을 읽고, updated_at 은 글자 그대로 둔다', async () => {
    const pending = fetchPaperForEdit('p1');
    await Promise.resolve();
    expect(calls).toEqual(['from:problem_papers']);
    resolvePaper?.({ data: paperRow, error: null });
    const data = await pending;
    expect(calls).toEqual(['from:problem_papers', 'from:problem_paper_items', 'items:read']);
    expect(data?.paper.updated_at).toBe('2026-11-12T03:04:05.123456+00:00');
    expect(data?.paper.settings.columns).toBe(1);
    expect(data?.items).toEqual([{ id: 'i1', orderIndex: 0, problemId: 'q1', snapshot: { stem_html: '' } }]);
  });

  it('문제지가 없으면 null, 문항 수가 안 맞으면(읽는 사이 바뀜) 다시 읽게 한다', async () => {
    const missing = fetchPaperForEdit('p1');
    await Promise.resolve();
    resolvePaper?.({ data: null, error: null });
    expect(await missing).toBeNull();

    itemResult = { data: [], error: null };
    const off = fetchPaperForEdit('p1');
    await Promise.resolve();
    resolvePaper?.({ data: paperRow, error: null });
    await expect(off).rejects.toThrow(/바뀌었어요/);
  });
});

describe('parsePaperEditStates · fetchPaperEditStates', () => {
  it('까닭·책·반영 대기를 읽고, 모르는 까닭은 고칠 수 없음으로 친다', () => {
    const states = parsePaperEditStates({
      a: { reason: null, in_book: true, pending: false, workbook: true },
      b: { reason: 'graded', in_book: false, pending: true },
      c: { reason: 'weird' },
      d: 'nope',
    });
    expect(states.get('a')).toEqual({ reason: null, inBook: true, pending: false, workbook: true });
    expect(states.get('b')).toEqual({ reason: 'graded', inBook: false, pending: true, workbook: false });
    expect(states.get('c')?.reason).toBe('grade_check_failed');
    expect(states.has('d')).toBe(false);
    expect(parsePaperEditStates(null).size).toBe(0);
  });

  it(`${PAPER_EDIT_STATES_MAX}개씩 나눠 묻는다`, async () => {
    rpc.mockResolvedValue({ data: {}, error: null });
    const ids = Array.from({ length: PAPER_EDIT_STATES_MAX + 1 }, (_, i) => `p${i}`);
    await fetchPaperEditStates(ids);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[0][0]).toBe('problem_paper_edit_states');
    expect((rpc.mock.calls[1][1] as { p_paper_ids: string[] }).p_paper_ids).toEqual([`p${PAPER_EDIT_STATES_MAX}`]);
  });
});

describe('paperEditError · updatePaper', () => {
  it('HINT 토큰으로 가른다', () => {
    expect(paperEditError({ hint: 'conflict' })).toBeInstanceOf(PaperEditConflictError);
    expect(paperEditError({ hint: 'missing' })).toBeInstanceOf(PaperMissingError);
    const blocked = paperEditError({ hint: 'in_book' });
    expect(blocked).toBeInstanceOf(PaperEditBlockedError);
    expect((blocked as InstanceType<typeof PaperEditBlockedError>).reason).toBe('in_book');
    expect(paperEditError({ message: '같은 지문의 문항이 떨어져 있습니다', hint: null }).message).toMatch(/떨어져/);
  });

  it('버전 글자·항목·설정 두 칸만 보내고 결과를 읽는다', async () => {
    rpc.mockResolvedValue({ data: { updated_at: 'v2', total_questions: 2, passage_changed: [2] }, error: null });
    const result = await updatePaper({
      paperId: 'p1', expectUpdatedAt: paperRow.updated_at, title: ' 새 제목 ',
      entries: [{ item: 'i1' }, { problem: 'q2' }], settings: { columns: 2, showSource: false },
    });
    expect(rpc).toHaveBeenCalledWith('update_problem_paper', {
      p_paper_id: 'p1', p_expect_updated_at: paperRow.updated_at, p_title: '새 제목',
      p_entries: [{ item: 'i1' }, { problem: 'q2' }], p_settings: { columns: 2, showSource: false },
    });
    expect(result).toEqual({ updatedAt: 'v2', totalQuestions: 2, passageChanged: [2] });
  });

  it('거절이면 갈래 오류를 던진다', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'x', hint: 'conflict', code: 'P0001' } });
    await expect(updatePaper({
      paperId: 'p1', expectUpdatedAt: 'v1', title: 't', entries: [{ item: 'i1' }], settings: { columns: 2, showSource: true },
    })).rejects.toBeInstanceOf(PaperEditConflictError);
  });
});

describe('paperEditHref', () => {
  it('책에 담겼거나 평가문제집 문항이 든 문제지는 책 쪽 고치기 화면(평가문제집이 보인다)', () => {
    expect(paperEditHref('p1', { inBook: false, workbook: false })).toBe('/problems/papers/p1/edit');
    expect(paperEditHref('p1', { inBook: true, workbook: false })).toBe('/books/papers/p1/edit');
    expect(paperEditHref('p1', { inBook: false, workbook: true })).toBe('/books/papers/p1/edit');
  });
});

