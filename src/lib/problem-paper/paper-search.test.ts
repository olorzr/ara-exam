import { beforeEach, describe, expect, it, vi } from 'vitest';

type Res = { data: unknown; error: { message: string } | null };
type Call = [string, ...unknown[]];

/**
 * 가짜 요청 빌더 — 부른 차례를 적고, 표마다 정해 둔 결과를 돌려준다.
 * ⚠️ `or` 는 일부러 두지 않는다 — 이 저장소는 `.or()` 를 쓰지 않는다(paper-search.ts 머리말). 쓰면 TypeError 로 깨진다.
 */
const m = vi.hoisted(() => ({
  calls: [] as { table: string; calls: Call[] }[],
  results: {} as Record<string, Res[]>,
  profilesThrow: false,
}));

function builder(table: string) {
  const entry = { table, calls: [] as Call[] };
  m.calls.push(entry);
  const q: Record<string, unknown> = {};
  for (const k of ['select', 'eq', 'neq', 'ilike', 'in', 'order', 'limit']) {
    q[k] = (...args: unknown[]) => { entry.calls.push([k, ...args]); return q; };
  }
  q.then = (yes: (r: Res) => unknown, no: (e: unknown) => unknown) => {
    if (table === 'profiles' && m.profilesThrow) return Promise.reject(new Error('boom')).then(yes, no);
    const queue = m.results[table] ?? [];
    return Promise.resolve(queue.shift() ?? { data: [], error: null }).then(yes, no);
  };
  return q;
}

vi.mock('@/lib/supabase', () => ({ supabase: { from: (t: string) => builder(t) } }));
vi.mock('@/lib/supabase-public', () => ({ publicDb: () => ({ from: (t: string) => builder(t) }) }));

const { creatorKeyword, mergePapers, searchPapers, findCreatorIdsByName } = await import('./paper-search');
const { fetchPapers } = await import('./paper-list');

const paper = (id: string, created_at: string, user_id = 'u2') => ({ id, created_at, user_id, title: id });

beforeEach(() => {
  m.calls = [];
  m.results = {};
  m.profilesThrow = false;
});

const callsOf = (table: string, nth = 0) => m.calls.filter((c) => c.table === table)[nth]?.calls ?? [];

describe('creatorKeyword', () => {
  it("끝의 '선생님'·'쌤' 을 떼고 다듬는다", () => {
    expect(creatorKeyword('  최지은 선생님 ')).toBe('최지은');
    expect(creatorKeyword('이재랑쌤')).toBe('이재랑');
    expect(creatorKeyword('선생님')).toBe('');
  });
});

describe('mergePapers', () => {
  it('겹친 것을 없애고 최근 것부터(같으면 id 내림차순) 상한까지', () => {
    const a = [paper('p1', '2026-11-20'), paper('p3', '2026-11-22')];
    const b = [paper('p3', '2026-11-22'), paper('p2', '2026-11-20'), paper('p0', '2026-11-01')];
    expect(mergePapers([a, b], 3).map((p) => p.id)).toEqual(['p3', 'p2', 'p1']);
  });
});

describe('findCreatorIdsByName', () => {
  it('이름 조회가 실패하면 조용히 빈 목록이다(이름은 곁가지)', async () => {
    m.profilesThrow = true;
    await expect(findCreatorIdsByName('최지은')).resolves.toEqual([]);
  });

  it('% · _ 를 글자 그대로 찾는다', async () => {
    await findCreatorIdsByName('50%_\\');
    expect(callsOf('profiles')).toContainEqual(['ilike', 'name', '%50\\%\\_\\\\%']);
  });
});

describe('searchPapers', () => {
  it('제목은 이스케이프해서 찾고, 이름이 맞는 선생님이 없으면 둘째 조회를 하지 않는다', async () => {
    m.results.problem_papers = [{ data: [paper('p1', '2026-11-20')], error: null }];
    const found = await searchPapers('others', 'u1', '50%');
    expect(found.map((p) => p.id)).toEqual(['p1']);
    expect(m.calls.filter((c) => c.table === 'problem_papers')).toHaveLength(2);
    expect(callsOf('problem_papers', 0)).toContainEqual(['ilike', 'title', '%50\\%%']);
    expect(callsOf('problem_papers', 0)).toContainEqual(['neq', 'user_id', 'u1']);
    // 둘째 빌더는 만들었어도 조건을 걸어 보내지 않는다
    expect(callsOf('problem_papers', 1).some(([k]) => k === 'in')).toBe(false);
  });

  it('이름이 맞는 선생님의 문제지를 제목으로 찾은 것과 합친다 — 두 조회 모두 탭 조건이 걸린다', async () => {
    m.results.profiles = [{ data: [{ id: 'u2' }], error: null }];
    m.results.problem_papers = [
      { data: [paper('p1', '2026-11-20')], error: null },
      { data: [paper('p2', '2026-11-21'), paper('p1', '2026-11-20')], error: null },
    ];
    const found = await searchPapers('others', 'u1', '최지은 선생님');
    expect(found.map((p) => p.id)).toEqual(['p2', 'p1']);
    expect(callsOf('profiles')).toContainEqual(['ilike', 'name', '%최지은%']);
    expect(callsOf('problem_papers', 1)).toContainEqual(['in', 'user_id', ['u2']]);
    expect(callsOf('problem_papers', 1)).toContainEqual(['neq', 'user_id', 'u1']);
  });

  it('문제지 조회가 실패하면 던진다', async () => {
    m.results.problem_papers = [{ data: null, error: { message: '네트워크' } }];
    await expect(searchPapers('mine', 'u1', '음운')).rejects.toMatchObject({ message: '네트워크' });
  });
});

describe('fetchPapers', () => {
  it('찾는 말이 없으면 예전처럼 최근 목록만 — 제목 조건을 걸지 않는다', async () => {
    m.results.problem_papers = [{ data: [paper('p1', '2026-11-20')], error: null }];
    await fetchPapers('mine', 'u1');
    expect(callsOf('problem_papers').some(([k]) => k === 'ilike')).toBe(false);
    expect(callsOf('problem_papers')).toContainEqual(['eq', 'user_id', 'u1']);
  });

  it('찾는 말이 있으면 찾기로 간다', async () => {
    await fetchPapers('mine', 'u1', '음운');
    expect(callsOf('problem_papers')).toContainEqual(['ilike', 'title', '%음운%']);
  });
});
