import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

/**
 * 아카이브 조회가 PostgREST 에 **어떤 요청**을 보내는지 고정한다.
 *
 * ⚠️ 배열 컬럼 조건(`area_path`·`unit_path`)은 원소를 큰따옴표로 감싼 리터럴이어야 한다. postgrest-js 에
 *    배열을 그대로 넘기면 따옴표 없이 join 해서 「소녀, 두드리다」가 두 원소로 갈려 0건이 됐다(2026-09-27).
 * ⚠️ 작품·문법 축은 GIN 을 타는 함수(sql/72)에서 출발한다 — **POST 본문**에 작품·문법·출처 칸이 실리고
 *    URL 에는 나머지 조건·정렬·쪽만 남는다(archive-rpc.ts). 헬퍼 단위 테스트는 "호출부가 헬퍼를 안 쓴다" 는
 *    회귀를 못 잡으므로 여기서 요청 층을 본다.
 */

interface Captured {
  url: URL;
  method: string;
  body: unknown;
  prefer: string | null;
}

const captured: Captured[] = [];

vi.mock('@/lib/supabase', () => {
  const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = input instanceof Request ? input.url : String(input);
    const raw = typeof init?.body === 'string' ? init.body : null;
    captured.push({
      url: new URL(url),
      method: init?.method ?? 'GET',
      body: raw ? JSON.parse(raw) : null,
      prefer: new Headers(init?.headers).get('Prefer'),
    });
    return new Response('[]', {
      status: 200,
      headers: { 'content-type': 'application/json', 'content-range': '*/0' },
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

const { fetchProblemPage, runProblemQuery, PROBLEM_LIST_SELECT } = await import('./queries');

/** 마지막 요청 */
function last(): Captured {
  return captured[captured.length - 1];
}

/** 마지막 요청의 필터 파라미터 값 */
function lastParam(name: string): string | null {
  return last().url.searchParams.get(name);
}

const RPC_PATH = '/rest/v1/rpc/problems_for_archive';
const TABLE_PATH = '/rest/v1/problems';

beforeEach(() => {
  captured.length = 0;
});

describe('fetchProblemPage — 작품·문법 축은 함수에서 출발한다(sql/72)', () => {
  it('작품명은 POST 본문으로 보낸다 — 쉼표가 든 작품명도 원소 하나다', async () => {
    await fetchProblemPage({ work_title: '소녀, 두드리다' });
    expect(captured).toHaveLength(1);
    expect(last().url.pathname).toBe(RPC_PATH);
    expect(last().method).toBe('POST');
    expect(last().body).toEqual({
      p_work_title: '소녀, 두드리다', p_only_work: false, p_grammar_paths: null, p_source: {},
    });
    expect(lastParam('work_titles')).toBeNull();
  });

  it('목록 select·읽는 순서·쪽·정확한 개수는 URL 에 그대로 실린다', async () => {
    await fetchProblemPage({ work_title: '동백꽃', page: 2 });
    expect(lastParam('select')).toContain('source:problem_sources!inner(*)');
    expect(lastParam('order')).toBe('source_id.asc,passage_id.asc.nullslast,page_no.asc,number.asc.nullslast,id.asc');
    expect(lastParam('offset')).toBe('120');
    expect(lastParam('limit')).toBe('60');
    expect(last().prefer).toContain('count=exact');
  });

  it('문법 경로는 본문으로, 영역·단원은 URL 의 포함(cs)으로 — 함수 결과에 건다', async () => {
    await fetchProblemPage({
      area_path: ['문학', '현대시'],
      unit_path: ['1. 나를 깨우는, 문학'],
      grammar_paths: ['단어 > 품사 > 명사', '단어 > 품사 > 대명사'],
    });
    expect(last().url.pathname).toBe(RPC_PATH);
    expect(last().body).toMatchObject({ p_grammar_paths: ['단어 > 품사 > 명사', '단어 > 품사 > 대명사'] });
    expect(lastParam('grammar_paths')).toBeNull();
    expect(lastParam('area_path')).toBe('cs.{"문학","현대시"}');
    expect(lastParam('unit_path')).toBe('cs.{"1. 나를 깨우는, 문학"}');
    expect(lastParam('order')).toBe('created_at.desc,page_no.asc,number.asc.nullslast,id.asc');
  });

  it('출처 칸은 본문(p_source)으로 — 함수 결과의 임베드에는 필터를 못 건다(PostgREST 14.5)', async () => {
    await fetchProblemPage({ work_title: '동백꽃', grades: ['중1', '중2', '중3'], year: '2025', textbook: '' });
    expect(last().body).toMatchObject({
      p_source: { year: '2025', textbook: '', grades: ['중1', '중2', '중3'] },
    });
    expect([...last().url.searchParams.keys()].filter((k) => k.startsWith('source.'))).toEqual([]);
  });

  it('작품·문법이 없으면 예전처럼 표에서 출발한다 — 영역·단원은 포함(cs)', async () => {
    await fetchProblemPage({ area_path: ['문학', '현대시'], unit_path: ['1. 나를 깨우는, 문학'] });
    expect(last().url.pathname).toBe(TABLE_PATH);
    expect(last().method).toBe('GET');
    expect(lastParam('area_path')).toBe('cs.{"문학","현대시"}');
    expect(lastParam('unit_path')).toBe('cs.{"1. 나를 깨우는, 문학"}');
  });

  it('작품명이 비어 있으면 함수를 부르지 않고 그 조건도 걸지 않는다', async () => {
    await fetchProblemPage({ work_title: '' });
    expect(last().url.pathname).toBe(TABLE_PATH);
    expect(lastParam('work_titles')).toBeNull();
  });

  it('함수 경로에서는 정렬 칸을 select 에 보탠다 — 가벼운 select 도 정렬할 수 있게', async () => {
    await runProblemQuery({ grammar_paths: ['음운'] }, 'reading', 0, 9, 'id, passage_id, source:problem_sources!inner(id)');
    expect(lastParam('select')).toBe('id,passage_id,source:problem_sources!inner(id),source_id,page_no,number');
    await runProblemQuery({ grammar_paths: ['음운'] }, 'reading', 0, 9, PROBLEM_LIST_SELECT);
    expect(lastParam('select')).toBe(PROBLEM_LIST_SELECT.replace(/\s/g, ''));
  });
});

describe("fetchProblemPage — '그 작품만 · 그 문법만'", () => {
  it('작품 하나만 묻는 문항은 본문의 p_only_work 로 건다 — 함수가 배열 같음(=)을 더 건다', async () => {
    await fetchProblemPage({ work_title: '소녀, 두드리다', only_work: true });
    expect(last().body).toMatchObject({ p_work_title: '소녀, 두드리다', p_only_work: true });
    expect(lastParam('work_titles')).toBeNull();
  });

  it('지문 대영역은 URL 의 글자 칸 in 이다 — 빈 값(지문 없음)이 뒤에 붙는다', async () => {
    await fetchProblemPage({ grammar_paths: ['음운'], passage_areas: ['화법과 언어', ''] });
    expect(last().url.pathname).toBe(RPC_PATH);
    expect(lastParam('passage_area')).toBe('in.(화법과 언어,)');
  });

  it('켜지 않으면 예전 그대로다', async () => {
    await fetchProblemPage({ work_title: '동백꽃' });
    expect(last().body).toMatchObject({ p_only_work: false });
    expect(lastParam('passage_area')).toBeNull();
    await fetchProblemPage({ passage_areas: [] });
    expect(lastParam('passage_area')).toBeNull();
  });
});

describe('fetchProblemPage — 학교급', () => {
  it('학년 여럿은 출처 임베드의 학년에 in 으로 건다', async () => {
    await fetchProblemPage({ grades: ['중1', '중2', '중3'] });
    expect(lastParam('source.grade')).toBe('in.(중1,중2,중3)');
  });

  it('학년 칸과 함께 걸리면 두 조건이 다 실린다', async () => {
    await fetchProblemPage({ grade: '고2', grades: ['고1', '고2', '고3'] });
    expect(last().url.searchParams.getAll('source.grade')).toEqual(['eq.고2', 'in.(고1,고2,고3)']);
  });

  it('빈 목록은 조건을 만들지 않는다', async () => {
    await fetchProblemPage({ grades: [] });
    expect(lastParam('source.grade')).toBeNull();
  });
});

describe('fetchProblemPage — 검색', () => {
  it('검색어는 소문자로 바꿔 like 로 건다 — search_text 가 이미 소문자라 ilike 가 필요 없다(sql/66)', async () => {
    await fetchProblemPage({ search: '  Sa미인곡 ' });
    expect(lastParam('search_text')).toBe('like.%sa미인곡%');
  });

  it('% _ \\ 는 글자 그대로 찾게 이스케이프한다', async () => {
    await fetchProblemPage({ search: '50%_a' });
    expect(lastParam('search_text')).toBe('like.%50\\%\\_a%');
  });
});
