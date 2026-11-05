import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const requests: URL[] = [];

vi.mock('@/lib/supabase', () => {
  const fetch = async (input: RequestInfo | URL): Promise<Response> => {
    requests.push(new URL(input instanceof Request ? input.url : String(input)));
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

const { passagePickName, searchPassages, searchPassagesByTitle } = await import('./passage-search');

beforeEach(() => {
  requests.length = 0;
});

describe('지문 찾기 — 평가문제집은 뺀다(책 만들기에서만 쓴다)', () => {
  it('최근 목록·제목·지은이 검색 모두 출처 임베드에 다름으로 건다', async () => {
    await searchPassages('');
    await searchPassages('양반');
    await searchPassagesByTitle('양반전', null);
    expect(requests).toHaveLength(4);
    for (const url of requests) {
      expect(url.searchParams.get('source.source_type')).toBe('neq.평가문제집');
    }
  });
});

describe('passagePickName', () => {
  it('제목이 없으면 머리글 범위로, 그것도 없으면 기본 이름으로 보여 준다', () => {
    expect(passagePickName({ title: '진달래꽃', label: '[1~3]' })).toBe('진달래꽃');
    expect(passagePickName({ title: '  ', label: '[1~3]' })).toBe('[1~3]');
    expect(passagePickName({ title: '', label: '' })).toBe('제목 없는 지문');
  });
});
