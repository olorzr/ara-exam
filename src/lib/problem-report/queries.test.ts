import { beforeEach, describe, expect, it, vi } from 'vitest';

type Call = [string, ...unknown[]];
const m = vi.hoisted(() => ({
  rpc: [] as [string, unknown][],
  rpcResult: { data: 'r1' as unknown, error: null as { message: string } | null },
  calls: [] as Call[],
  result: { data: [] as unknown, error: null as unknown, count: 0 },
  /** 차례대로 돌려줄 결과 — 비면 `result` */
  queue: [] as { data: unknown; error: unknown; count?: number }[],
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: async (name: string, args: unknown) => { m.rpc.push([name, args]); return m.rpcResult; },
    from: (table: string) => {
      m.calls.push(['from', table]);
      const q: Record<string, unknown> = {};
      for (const k of ['select', 'eq', 'in', 'order', 'limit', 'maybeSingle']) {
        q[k] = (...args: unknown[]) => { m.calls.push([k, ...args]); return q; };
      }
      q.then = (yes: (r: unknown) => unknown) => Promise.resolve(m.queue.shift() ?? m.result).then(yes);
      return q;
    },
  },
}));

const {
  countOpenReports, fetchPaperItemRefs, fetchProblemOrigin, fetchProblemReports, resolveProblemReport, submitProblemReport,
} = await import('./queries');

beforeEach(() => {
  m.rpc = [];
  m.calls = [];
  m.rpcResult = { data: 'r1', error: null };
  m.result = { data: [], error: null, count: 0 };
  m.queue = [];
});

describe('submitProblemReport', () => {
  it('문제지 항목 신고는 항목 id 만, 문항 신고는 문항 id 만 싣는다', async () => {
    await submitProblemReport({ category: 'answer', note: '정답', paperItemId: 'i1', paperRevision: 'rev' });
    await submitProblemReport({ category: 'text', note: '', problemId: 'p1' });
    expect(m.rpc).toEqual([
      ['report_problem', { p_category: 'answer', p_note: '정답', p_problem_id: null, p_paper_item_id: 'i1', p_paper_revision: 'rev' }],
      ['report_problem', { p_category: 'text', p_note: '', p_problem_id: 'p1', p_paper_item_id: null, p_paper_revision: null }],
    ]);
  });

  it('RPC 오류 문구를 그대로 던진다', async () => {
    m.rpcResult = { data: null, error: { message: '기타 신고는 내용을 적어 주세요' } };
    await expect(submitProblemReport({ category: 'other', note: '', problemId: 'p1' })).rejects.toThrow('기타 신고는 내용을 적어 주세요');
  });
});

describe('fetchProblemReports · resolveProblemReport · countOpenReports', () => {
  it('접수 중은 open 만, 처리됨은 고침·반려를 최근 것부터 읽는다', async () => {
    await fetchProblemReports('open');
    expect(m.calls).toContainEqual(['eq', 'status', 'open']);
    m.calls = [];
    await fetchProblemReports('closed');
    expect(m.calls).toContainEqual(['in', 'status', ['fixed', 'rejected']]);
    expect(m.calls).toContainEqual(['order', 'created_at', { ascending: false }]);
  });

  it('처리는 RPC 로 보낸다', async () => {
    m.rpcResult = { data: null, error: null };
    await resolveProblemReport('r1', 'fixed', '고쳤어요');
    expect(m.rpc).toEqual([['resolve_problem_report', { p_id: 'r1', p_status: 'fixed', p_note: '고쳤어요' }]]);
  });

  it('같은 문항의 접수 중 신고 수 — 못 읽으면 0', async () => {
    m.result = { data: null, error: null, count: 3 };
    expect(await countOpenReports('p1')).toBe(3);
    m.result = { data: null, error: { message: 'x' }, count: 0 };
    expect(await countOpenReports('p1')).toBe(0);
  });
});

describe('fetchPaperItemRefs', () => {
  const items = [{ id: 'i1', problem_id: 'p1', snapshot: {} }];

  it('항목을 읽은 뒤 문제지 판을 다시 읽어 화면의 판과 견준다', async () => {
    m.queue = [{ data: items, error: null }, { data: { updated_at: 'rev-1' }, error: null }];
    expect(await fetchPaperItemRefs('paper1', 'rev-1')).toEqual({ items, stale: false });
    const froms = m.calls.filter((c) => c[0] === 'from').map((c) => c[1]);
    expect(froms).toEqual(['problem_paper_items', 'problem_papers']);
  });

  it('판이 다르거나 문제지가 없으면 stale', async () => {
    m.queue = [{ data: items, error: null }, { data: { updated_at: 'rev-2' }, error: null }];
    expect((await fetchPaperItemRefs('paper1', 'rev-1')).stale).toBe(true);
    m.queue = [{ data: items, error: null }, { data: null, error: null }];
    expect((await fetchPaperItemRefs('paper1', 'rev-1')).stale).toBe(true);
  });
});

describe('fetchProblemOrigin — 신고 창의 원본 쪽', () => {
  it('문항의 쪽과 출처의 쪽 수를 한 번에 읽는다', async () => {
    m.result = { data: { page_no: 3, source: { id: 's1', page_count: 8, source_type: '내신기출' } }, error: null, count: 0 };
    expect(await fetchProblemOrigin('p1')).toEqual({ sourceId: 's1', pageNo: 3, pageCount: 8, sourceType: '내신기출' });
    expect(m.calls).toContainEqual(['from', 'problems']);
    expect(m.calls).toContainEqual(['select', 'page_no, source:problem_sources!inner(id, page_count, source_type)']);
    expect(m.calls).toContainEqual(['eq', 'id', 'p1']);
  });

  it('문항이 없거나 쪽이 범위 밖이면 null', async () => {
    m.result = { data: null, error: null, count: 0 };
    expect(await fetchProblemOrigin('p1')).toBeNull();
    m.result = { data: { page_no: 9, source: { id: 's1', page_count: 8, source_type: '' } }, error: null, count: 0 };
    expect(await fetchProblemOrigin('p1')).toBeNull();
    m.result = { data: { page_no: 0, source: { id: 's1', page_count: 8, source_type: '' } }, error: null, count: 0 };
    expect(await fetchProblemOrigin('p1')).toBeNull();
  });

  it('조회가 실패하면 던진다', async () => {
    m.result = { data: null, error: { message: 'x' }, count: 0 };
    await expect(fetchProblemOrigin('p1')).rejects.toBeTruthy();
  });
});
