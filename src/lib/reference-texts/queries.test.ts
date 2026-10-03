import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { toReferenceTextQuery } from './filters';

/**
 * 작품 전문 조회가 PostgREST 에 **어떤 URL** 을 보내는지 고정한다.
 *
 * ⚠️ 단원(jsonb)은 JSON **문자열**이어야 `cs.[{…}]` 로 나간다. postgrest-js 에 배열을 넘기면
 *    따옴표 없이 이어 붙여 쉼표 든 단원 이름이 쪼개진다(문제 은행 queries.test.ts 와 같은 이유).
 *    헬퍼 단위 테스트로는 "호출부가 문자열을 안 넘긴다" 는 회귀를 못 잡으므로 URL 층을 본다.
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

const { REFERENCE_TEXT_LIST_COLUMNS, fetchReferenceTextList, searchReferenceTexts } =
  await import('./queries');

/** 마지막 요청의 파라미터 값 */
function lastParam(name: string): string | null {
  return captured[captured.length - 1].searchParams.get(name);
}

const unit = {
  grade: '중2', textbook: '천재(노미숙)', semester: '1학기', unit_path: ['1. 나를 깨우는, 문학'],
};

beforeEach(() => {
  captured.length = 0;
});

describe('fetchReferenceTextList — 축 조건의 URL 표기', () => {
  it('축이 없으면 조건 없이 목록 컬럼만 읽는다', async () => {
    await fetchReferenceTextList();
    expect(lastParam('select')).toBe(REFERENCE_TEXT_LIST_COLUMNS);
    expect(lastParam('units')).toBeNull();
    expect(lastParam('grammar_paths')).toBeNull();
    expect(lastParam('title')).toBeNull();
  });

  it('⚠️ 단원은 JSON 문자열 포함(cs) — 쉼표 든 단원 이름이 원소 하나로 남는다', async () => {
    await fetchReferenceTextList(200, toReferenceTextQuery({ kind: 'unit', unit }));
    expect(lastParam('units')).toBe(
      'cs.[{"grade":"중2","textbook":"천재(노미숙)","semester":"1학기","unit_path":["1. 나를 깨우는, 문학"]}]',
    );
  });

  it('분류 없음은 빈 값과의 같음이다', async () => {
    await fetchReferenceTextList(200, toReferenceTextQuery({ kind: 'unit-none' }));
    expect(lastParam('units')).toBe('eq.[]');
    await fetchReferenceTextList(200, toReferenceTextQuery({ kind: 'grammar-none' }));
    expect(lastParam('grammar_paths')).toBe('eq.{}');
  });

  it('문법은 고른 마디와 그 아래 경로의 겹침(ov)이다', async () => {
    await fetchReferenceTextList(200, toReferenceTextQuery({ kind: 'grammar', path: ['단어', '품사'] }));
    const value = lastParam('grammar_paths') ?? '';
    expect(value.startsWith('ov.{"단어 > 품사"')).toBe(true);
    expect(value).toContain('"단어 > 품사 > 명사"');
  });

  it('작품은 제목 같음이다', async () => {
    await fetchReferenceTextList(200, toReferenceTextQuery({ kind: 'work', title: '봄봄' }));
    expect(lastParam('title')).toBe('eq.봄봄');
  });
});

describe('searchReferenceTexts — 검색어와 축이 함께 걸린다', () => {
  it('제목 ilike 옆에 축 조건이 붙는다', async () => {
    await searchReferenceTexts('봄', 'title', 200, toReferenceTextQuery({ kind: 'unit', unit }));
    expect(lastParam('title')).toBe('ilike.%봄%');
    expect(lastParam('units')).toContain('cs.[');
  });

  it('축 없이 부르면(문제 만들기 참고자료 찾기) 예전과 같다', async () => {
    await searchReferenceTexts('김유정', 'author');
    expect(lastParam('author')).toBe('ilike.%김유정%');
    expect(lastParam('units')).toBeNull();
    expect(lastParam('limit')).toBe('30');
  });
});
