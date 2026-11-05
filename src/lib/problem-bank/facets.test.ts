import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

/**
 * 패싯이 **RPC 한 번**으로 읽히고, 한 탭 안에서 나눠 쓰이는지 고정한다(sql/66 → 서버 캐시 sql/71).
 *
 * ⚠️ 예전에는 문항 표를 1,000행씩 순서대로 긁었다(열마다 ~29번 왕복, 20,000행에서 잘림).
 *    표를 긁는 요청이 되살아나면 `requests` 가 늘어 이 테스트가 깨진다.
 */

const requests: URL[] = [];
const methods: string[] = [];
let respond: () => Response = () => new Response('{}', { status: 200 });

vi.mock('@/lib/supabase', () => {
  const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = input instanceof Request ? input.url : String(input);
    requests.push(new URL(url));
    methods.push(init?.method ?? 'GET');
    return respond();
  };
  return {
    supabase: createClient('http://localhost:54321', 'test-anon-key', {
      db: { schema: 'exam' },
      global: { fetch },
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
});

const facets = await import('./facets');
const { invalidateArchiveFacets } = await import('./facets-cache');

const PAYLOAD = {
  sources: [
    { school_name: '상현중', year: '2026', grade: '중2', textbook: '천재', source_type: '내신기출', semester: '1학기', exam_type: '중간' },
    { school_name: '도선고', year: '2025', grade: '고2', textbook: '', source_type: '내신기출', semester: '1학기', exam_type: '기말' },
    // 평가문제집에만 있는 학년도·학년·교과서 — 숨기는 화면의 칸에 남으면 골랐을 때 0건이다
    { school_name: '', year: '2024', grade: '중3', textbook: '동아', source_type: '평가문제집', semester: '2학기', exam_type: '', title: '동아 책' },
  ],
  area_paths: [['문학', '운문 문학'], ['독서와 작문', '독서']],
  unit_paths: [['3. 역사와 함께 흐르는, 문학', '(3) 조선 시대 문학']],
  grammar_paths: [{ paths: ['단어 > 품사 > 명사'], n: 3 }],
  work_titles: [{ titles: ['사미인곡', '속미인곡'], n: 4 }, { titles: ['사미인곡'], n: 6 }],
  passage_works: [
    { title: '사미인곡', author: '정철', area_path: ['문학', '운문 문학'], n: 9 },
    { title: '속미인곡', author: '정철', area_path: ['문학'], n: 2 },
    { title: '양반전', author: '박지원', area_path: ['문학'], n: 1 },
  ],
  // 평가문제집 몫(sql/85) — 기본 화면에서는 어디에도 안 든다
  area_paths_workbook: [['화법과 언어', '언어']],
  unit_paths_workbook: [['1. 평가 단원', '(1) 소단원']],
  grammar_paths_workbook: [{ paths: ['단어 > 품사 > 명사'], n: 2 }],
  work_titles_workbook: [{ titles: ['사미인곡'], n: 5 }, { titles: ['양반전'], n: 7 }],
};

function ok(): Response {
  return new Response(JSON.stringify(PAYLOAD), { status: 200, headers: { 'content-type': 'application/json' } });
}

beforeEach(() => {
  requests.length = 0;
  methods.length = 0;
  respond = ok;
  invalidateArchiveFacets();
});

describe('아카이브 패싯', () => {
  it('다섯 패싯이 RPC 한 번을 나눠 쓴다', async () => {
    const [source, area, unit, grammar, works] = await Promise.all([
      facets.fetchSourceFacets(), facets.fetchAreaFacets(), facets.fetchUnitFacets(),
      facets.fetchGrammarFacets(), facets.fetchWorkFacets(),
    ]);

    expect(requests).toHaveLength(1);
    expect(requests[0].pathname).toBe('/rest/v1/rpc/archive_facets');
    expect(source.schools).toEqual(['도선고', '상현중']);
    expect(source.schoolsByLevel).toEqual({ 중등: ['상현중'], 고등: ['도선고'] });
    expect(area).toEqual([['독서와 작문', '독서'], ['문학', '운문 문학']]);
    expect(unit).toHaveLength(1);
    expect(grammar.find((g) => g.path === '단어')?.count).toBe(3);
    expect(works).toEqual([
      { title: '사미인곡', author: '정철', count: 10, kind: 'literary' },
      { title: '속미인곡', author: '정철', count: 4, kind: 'literary' },
    ]);
  });

  it('기본은 평가문제집을 뺀다 — 출처 칸·책 가지·건수 어디에도 안 든다', async () => {
    const [source, area, unit, grammar, works] = await Promise.all([
      facets.fetchSourceFacets(), facets.fetchAreaFacets(), facets.fetchUnitFacets(),
      facets.fetchGrammarFacets(), facets.fetchWorkFacets(),
    ]);
    expect(source.years).toEqual(['2026', '2025']);
    expect(source.grades).not.toContain('중3');
    expect(source.textbooks).toEqual(['천재']);
    expect(source.semesters).toEqual(['1학기']);
    expect(source.workbooks).toEqual([]);
    expect(area).toHaveLength(2);
    expect(unit).toHaveLength(1);
    expect(grammar.find((g) => g.path === '단어')?.count).toBe(3);
    expect(works.map((w) => [w.title, w.count])).toEqual([['사미인곡', 10], ['속미인곡', 4]]);
  });

  it('보이는 화면은 평가문제집 몫을 더한다 — 같은 작품은 건수가 합쳐진다', async () => {
    const [source, area, unit, grammar, works] = await Promise.all([
      facets.fetchSourceFacets(true), facets.fetchAreaFacets(true), facets.fetchUnitFacets(true),
      facets.fetchGrammarFacets(true), facets.fetchWorkFacets(true),
    ]);
    expect(source.years).toEqual(['2026', '2025', '2024']);
    expect(source.textbooks).toEqual(['동아', '천재']);
    expect(source.workbooks.map((w) => w.title)).toEqual(['동아 책']);
    expect(area).toHaveLength(3);
    expect(unit).toHaveLength(2);
    expect(grammar.find((g) => g.path === '단어')?.count).toBe(5);
    expect(works.map((w) => [w.title, w.author, w.count])).toEqual([
      ['사미인곡', '정철', 15], ['속미인곡', '정철', 4], ['양반전', '박지원', 7],
    ]);
  });

  it('두 화면이 같은 캐시를 쓴다 — 모드마다 RPC 를 다시 부르지 않는다', async () => {
    await facets.fetchWorkFacets();
    await facets.fetchWorkFacets(true);
    expect(requests).toHaveLength(1);
  });

  it('RPC 는 POST 다 — GET 은 PostgREST 가 읽기 전용 트랜잭션으로 돌려 서버 캐시를 다시 지을 수 없다(sql/71)', async () => {
    await facets.fetchWorkFacets();
    expect(methods).toEqual(['POST']);
  });

  it('다시 열어도 같은 탭 안에서는 다시 묻지 않는다', async () => {
    await facets.fetchWorkFacets();
    await facets.fetchSourceFacets();
    expect(requests).toHaveLength(1);
  });

  it('무효화하면 다음 조회가 새로 읽는다 — 문항을 고친 뒤', async () => {
    await facets.fetchWorkFacets();
    invalidateArchiveFacets();
    await facets.fetchWorkFacets();
    expect(requests).toHaveLength(2);
  });

  it('실패한 조회는 남기지 않는다 — 다음 시도가 다시 묻는다', async () => {
    respond = () => new Response('{"message":"boom"}', { status: 500, headers: { 'content-type': 'application/json' } });
    await expect(facets.fetchWorkFacets()).rejects.toBeTruthy();

    respond = ok;
    const works = await facets.fetchWorkFacets();
    expect(requests).toHaveLength(2);
    expect(works).toHaveLength(2);
  });
});
