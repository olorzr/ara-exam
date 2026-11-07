import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';

/** 트리 재료 조회가 묶음의 부분을 빼는지 URL 층에서 고정한다 — 안 빼면 트리 `(n)` 이 목록과 다른 수를 낸다 */

const captured: URL[] = [];

vi.mock('@/lib/supabase', () => {
  const fetch = async (input: RequestInfo | URL): Promise<Response> => {
    captured.push(new URL(input instanceof Request ? input.url : String(input)));
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return {
    supabase: createClient('http://localhost:54321', 'test-anon-key', {
      db: { schema: 'exam' },
      global: { fetch },
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
});

const { fetchReferenceTextFacets } = await import('./facets');

beforeEach(() => {
  captured.length = 0;
});

describe('fetchReferenceTextFacets', () => {
  it('묶음의 부분을 세지 않는다', async () => {
    await fetchReferenceTextFacets();
    expect(captured[0].searchParams.get('part_of')).toBe('is.null');
  });
});
