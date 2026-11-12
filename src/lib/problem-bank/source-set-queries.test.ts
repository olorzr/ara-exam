import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';

/**
 * 세트 조회가 PostgREST 에 **무엇을 몇 번** 묻는지 고정한다(가짜 fetch 가 요청만 받아 적는다 — source-list.test.ts 와 같은 방식).
 */

const requests: { url: URL; method: string }[] = [];
let respond: (url: URL) => Response = () => json([]);

function json(body: unknown, range?: string): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', ...(range ? { 'content-range': range } : {}) },
  });
}

vi.mock('@/lib/supabase', () => {
  const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    requests.push({ url, method: init?.method ?? 'GET' });
    return respond(url);
  };
  return {
    supabase: createClient('http://localhost:54321', 'test-anon-key', {
      db: { schema: 'exam' },
      global: { fetch },
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
});

const { fetchSetSources, fetchSourceSets } = await import('./source-set-queries');

beforeEach(() => {
  requests.length = 0;
  respond = () => json([]);
});

/** 출처 행 */
function source(i: number, over: Record<string, unknown> = {}) {
  return {
    id: `s${String(i).padStart(4, '0')}`, source_type: '내신기출', title: `시험 ${i}`, school_name: `학교${i}`,
    year: '2026', grade: '고2', semester: '1학기', exam_type: '기말', textbook: '문학 비상', publisher: '',
    problem_count: 30, ...over,
  };
}

describe('fetchSourceSets', () => {
  it('RPC 한 번으로 읽고 평가원 학년을 합쳐 정렬한다', async () => {
    respond = () => json([
      { source_type: '모의고사', year: '2027', grade: '', semester: '', exam_type: '6월 모평', textbook: '', publisher: '평가원', exam_count: 1, names: ['6월 (언어와 매체)'] },
      { source_type: '내신기출', year: '2025', grade: '중2', semester: '1학기', exam_type: '중간', textbook: '', publisher: '', exam_count: 2, names: ['나중', '가중'] },
      { source_type: '모의고사', year: '2027', grade: '고3', semester: '', exam_type: '6월 모평', textbook: '', publisher: '평가원', exam_count: 2, names: ['6월 (공통)', '6월 (화법과 작문)'] },
      { source_type: '평가문제집', year: '2026', grade: '중2', semester: '1학기', exam_type: '', textbook: '', publisher: '', exam_count: 1, names: ['책'] },
    ]);
    const sets = await fetchSourceSets();
    expect(requests).toHaveLength(1);
    expect(requests[0].url.pathname).toBe('/rest/v1/rpc/source_sets');
    expect(sets.map((s) => [s.source_type, s.grade, s.exam_count])).toEqual([
      ['내신기출', '중2', 2],
      ['모의고사', '고3', 3],
    ]);
    expect(sets[0].names).toEqual(['가중', '나중']);
  });

  it('실패하면 던진다 — 빈 목록으로 삼키지 않는다', async () => {
    respond = () => new Response(JSON.stringify({ message: 'boom' }), { status: 500, headers: { 'content-type': 'application/json' } });
    await expect(fetchSourceSets()).rejects.toBeTruthy();
  });
});

describe('fetchSetSources', () => {
  const set = {
    source_type: '내신기출' as const, year: '2026', grade: '고2', semester: '1학기', exam_type: '기말',
    textbook: '', publisher: '',
  };

  it('세트 칸을 표 컬럼에 걸고(교과서 빈 값 = 빈 출처만) 문항 수 계산 열을 함께 받는다', async () => {
    respond = () => json([source(2, { school_name: '나고' }), source(1, { school_name: '가고' })], '0-1/2');
    const { rows, outside } = await fetchSetSources(set);
    expect(outside).toBe(0);
    const params = requests[0].url.searchParams;
    expect(params.get('select')).toBe('*,problem_count');
    expect(params.get('textbook')).toBe('eq.');
    expect(params.get('semester')).toBe('eq.1학기');
    expect(params.get('source_type')).toBe('eq.내신기출');
    expect(rows.map((r) => r.school_name)).toEqual(['가고', '나고']);
  });

  it('990행을 넘으면 이어 읽는다 — 말없이 자르지 않는다', async () => {
    const all = Array.from({ length: 1000 }, (_, i) => source(i));
    respond = (url) => {
      const offset = Number(url.searchParams.get('offset') ?? '0');
      const limit = Number(url.searchParams.get('limit') ?? '1000');
      const rows = all.slice(offset, offset + limit);
      return json(rows, `${offset}-${offset + rows.length - 1}/${all.length}`);
    };
    const { rows } = await fetchSetSources(set);
    expect(rows).toHaveLength(1000);
    expect(requests.length).toBe(2);
    expect(new Set(rows.map((r) => r.id)).size).toBe(1000);
  });

  it('모의고사는 주관이 다른 행을 빼고 그 수를 알린다 — 출처 조건(과 아카이브)에 주관 칸이 없다', async () => {
    respond = () => json([
      source(1, { source_type: '모의고사', publisher: '평가원', title: '수능 (공통)' }),
      source(2, { source_type: '모의고사', publisher: '교육청', title: '수능 (공통)' }),
    ], '0-1/2');
    const { rows, outside } = await fetchSetSources({
      source_type: '모의고사', year: '2026', grade: '고3', semester: '', exam_type: '수능', textbook: '', publisher: '평가원',
    });
    expect(rows.map((r) => r.id)).toEqual(['s0001']);
    expect(outside).toBe(1);
    // 평가원 회차는 학년을 걸지 않는다
    expect(requests[0].url.searchParams.get('grade')).toBeNull();
  });
});
