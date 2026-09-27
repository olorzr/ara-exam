import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

/**
 * 아카이브 조회가 PostgREST 에 **어떤 URL** 을 보내는지 고정한다.
 *
 * ⚠️ 배열 컬럼 조건(`work_titles`·`area_path`·`unit_path`·`grammar_paths`)은 원소를
 *    큰따옴표로 감싼 리터럴이어야 한다. postgrest-js 에 배열을 그대로 넘기면 따옴표 없이
 *    join 해서 「소녀, 두드리다」가 두 원소로 갈려 0건이 됐다(2026-09-27). 헬퍼 단위 테스트는
 *    "호출부가 헬퍼를 안 쓴다" 는 회귀를 못 잡으므로 여기서 요청 URL 층을 본다.
 */

const captured: URL[] = [];

vi.mock('@/lib/supabase', () => {
  const fetch = async (input: RequestInfo | URL): Promise<Response> => {
    const url = input instanceof Request ? input.url : String(input);
    captured.push(new URL(url));
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

const { fetchProblemPage } = await import('./queries');

/** 마지막 요청의 필터 파라미터 값 */
function lastParam(name: string): string | null {
  const url = captured[captured.length - 1];
  return url.searchParams.get(name);
}

beforeEach(() => {
  captured.length = 0;
});

describe('fetchProblemPage — 배열 컬럼 조건의 URL 표기', () => {
  it('쉼표가 든 작품명을 원소 하나로 보낸다', async () => {
    await fetchProblemPage({ work_title: '소녀, 두드리다' });
    expect(captured).toHaveLength(1);
    expect(lastParam('work_titles')).toBe('cs.{"소녀, 두드리다"}');
  });

  it('쉼표 없는 작품명도 같은 꼴이다', async () => {
    await fetchProblemPage({ work_title: '동백꽃' });
    expect(lastParam('work_titles')).toBe('cs.{"동백꽃"}');
  });

  it('영역·단원 경로는 포함(cs), 문법 경로는 겹침(ov)으로 보낸다', async () => {
    await fetchProblemPage({
      area_path: ['문학', '현대시'],
      unit_path: ['1. 나를 깨우는, 문학'],
      grammar_paths: ['단어 > 품사 > 명사', '단어 > 품사 > 대명사'],
    });
    expect(lastParam('area_path')).toBe('cs.{"문학","현대시"}');
    expect(lastParam('unit_path')).toBe('cs.{"1. 나를 깨우는, 문학"}');
    expect(lastParam('grammar_paths')).toBe('ov.{"단어 > 품사 > 명사","단어 > 품사 > 대명사"}');
  });

  it('작품명이 비어 있으면 그 조건을 걸지 않는다', async () => {
    await fetchProblemPage({ work_title: '' });
    expect(lastParam('work_titles')).toBeNull();
  });
});
