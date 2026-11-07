import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

/**
 * 상세 창 조회가 빼기 조건을 **어디에** 거는지 고정한다 — 연 문항이 아니라 형제 조회에만 건다.
 * 문항 조회가 한 행을 돌려줘야 형제 조회까지 가므로 응답을 주소로 가른다.
 */

const requested: URL[] = [];

vi.mock('@/lib/supabase', () => {
  const fetch = async (input: RequestInfo | URL): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    requested.push(url);
    const rows = url.searchParams.get('id') === 'eq.q1'
      ? [{ id: 'q1', source: { id: 's1' }, passage: { id: 'passage-1' } }]
      : [];
    return new Response(JSON.stringify(rows), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return {
    supabase: createClient('http://localhost:54321', 'test-anon-key', {
      db: { schema: 'exam' },
      global: { fetch },
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
});

const { fetchProblemDetail } = await import('./detail-queries');

beforeEach(() => { requested.length = 0; });

describe('fetchProblemDetail — 빼기 조건', () => {
  it('형제 조회에만 건다 — 연 문항은 이미 목록에 걸린 것이다', async () => {
    await fetchProblemDetail('q1', { exclude_paper_ids: ['p1'], answered_only: true });
    expect(requested).toHaveLength(2);
    const [problem, siblings] = requested;
    expect(problem.searchParams.get('answer')).toBeNull();
    expect(problem.searchParams.get('problem_paper_items')).toBeNull();
    expect(siblings.searchParams.get('passage_id')).toBe('eq.passage-1');
    expect(siblings.searchParams.get('answer')).toBe('neq.');
    expect(siblings.searchParams.get('problem_paper_items.paper_id')).toBe('in.(p1)');
    expect(siblings.searchParams.get('problem_paper_items')).toBe('is.null');
  });

  it('조건 없이 부르면 형제 조회가 예전 그대로다 — 아카이브 화면', async () => {
    await fetchProblemDetail('q1');
    expect(requested[1].searchParams.get('select')).toBe('*');
    expect(requested[1].searchParams.get('answer')).toBeNull();
  });
});
