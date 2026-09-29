import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';

/**
 * '올라간 기출' 목록이 PostgREST 에 **어떤 URL** 을 보내는지 고정한다.
 * (queries.test.ts 와 같은 방식 — 가짜 fetch 가 요청만 받아 적는다)
 */

const captured: URL[] = [];
let body = '[]';

vi.mock('@/lib/supabase', () => {
  const fetch = async (input: RequestInfo | URL): Promise<Response> => {
    const url = input instanceof Request ? input.url : String(input);
    captured.push(new URL(url));
    return new Response(body, {
      status: 200,
      headers: { 'content-type': 'application/json', 'content-range': '0-0/1' },
    });
  };
  return {
    supabase: createClient('http://localhost:54321', 'test-anon-key', {
      db: { schema: 'exam' },
      global: { fetch },
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
});

const { fetchSources } = await import('./source-list');

const last = () => captured[captured.length - 1];

beforeEach(() => {
  captured.length = 0;
  body = '[]';
});

describe('fetchSources — 조건', () => {
  it('조건 없이 부르면 최근 올린 순, 마지막 키는 id 다', async () => {
    await fetchSources();
    expect(last().searchParams.get('select')).toBe('*,problems(count)');
    expect(last().searchParams.get('order')).toBe('created_at.desc,id.desc');
    expect(last().searchParams.get('school_name')).toBeNull();
  });

  it('출처 칸은 표 자체의 컬럼에 건다(임베드 별칭이 아니다)', async () => {
    await fetchSources({ query: { school_name: '상현중', year: '', grades: ['중1', '중2'], sort: 'recent' } });
    expect(last().searchParams.get('school_name')).toBe('eq.상현중');
    // '' 은 '미지정만' 이다 — 조건이 사라지면 안 된다
    expect(last().searchParams.get('year')).toBe('eq.');
    expect(last().searchParams.get('grade')).toBe('in.(중1,중2)');
  });

  it('제목 검색은 와일드카드를 막고 ilike 로 건다', async () => {
    await fetchSources({ query: { title: '100%_봄', sort: 'recent' } });
    expect(last().searchParams.get('title')).toBe('ilike.%100\\%\\_봄%');
  });

  it('시험 차례는 학년도 → 학교 → 학년 → 학기 → 시험, 마지막은 id', async () => {
    await fetchSources({ query: { sort: 'exam' } });
    expect(last().searchParams.get('order'))
      .toBe('year.desc,school_name.asc,grade.asc,semester.asc,exam_type.desc,id.desc');
  });

  it('쪽을 이어 받을 때는 그 범위만 청한다', async () => {
    await fetchSources({ page: 2 });
    expect(last().searchParams.get('offset')).toBe('60');
    expect(last().searchParams.get('limit')).toBe('30');
  });
});

describe('fetchSources — 문항 수', () => {
  it('임베드한 개수를 줄에 펴고 임베드 칸은 걷는다', async () => {
    body = JSON.stringify([{ id: 'a', title: '가', problems: [{ count: 23 }] }, { id: 'b', title: '나', problems: [] }]);
    const page = await fetchSources();
    expect(page.rows.map((r) => r.problem_count)).toEqual([23, 0]);
    expect('problems' in page.rows[0]).toBe(false);
  });
});
