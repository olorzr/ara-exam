import { describe, it, expect } from 'vitest';
import { EMPTY_ARCHIVE_FACETS, parseArchiveFacets } from './facets-payload';

describe('parseArchiveFacets', () => {
  const good = {
    sources: [{
      school_name: '상현중', year: '2026', grade: '중2', textbook: '천재(정호웅)',
      source_type: '내신기출', semester: '1학기', exam_type: '중간',
    }],
    area_paths: [['문학', '운문 문학']],
    unit_paths: [['1. 나를 깨우는, 문학']],
    grammar_paths: [{ paths: ['단어 > 품사 > 명사'], n: 3 }],
    work_titles: [{ titles: ['사미인곡', '속미인곡'], n: 4 }],
    passage_works: [{ title: '사미인곡', author: '정철', area_path: ['문학'], n: 7 }],
  };

  it('서버 모양을 그대로 옮긴다', () => {
    expect(parseArchiveFacets(good)).toEqual(good);
  });

  it('응답이 객체가 아니면 빈 패싯이다 — 화면이 죽지 않게', () => {
    expect(parseArchiveFacets(null)).toEqual(EMPTY_ARCHIVE_FACETS);
    expect(parseArchiveFacets('oops')).toEqual(EMPTY_ARCHIVE_FACETS);
    expect(parseArchiveFacets([])).toEqual(EMPTY_ARCHIVE_FACETS);
  });

  it('키가 빠지거나 배열이 아니면 그 패싯만 빈다', () => {
    const parsed = parseArchiveFacets({ ...good, work_titles: 'x', area_paths: undefined });
    expect(parsed.work_titles).toEqual([]);
    expect(parsed.area_paths).toEqual([]);
    expect(parsed.passage_works).toHaveLength(1);
  });

  it('출처 칸의 null 은 빈 문자열로 읽는다(DB 의 빈 값 규약)', () => {
    const parsed = parseArchiveFacets({ ...good, sources: [{ ...good.sources[0], textbook: null, semester: null }] });
    expect(parsed.sources[0].textbook).toBe('');
    expect(parsed.sources[0].semester).toBe('');
  });

  it('모양이 어긋난 원소만 버리고 나머지는 살린다', () => {
    const parsed = parseArchiveFacets({
      ...good,
      sources: [good.sources[0], { ...good.sources[0], year: 2026 }, 'x'],
      area_paths: [['문학'], [], [1], 'x'],
      grammar_paths: [{ paths: ['단어'], n: 0 }, { paths: 'x', n: 1 }, { paths: ['음운'], n: 2 }],
      work_titles: [{ titles: ['봄봄'], n: 1.5 }, { titles: ['봄봄'], n: 2 }],
      passage_works: [{ title: '', author: '', area_path: [], n: 1 }, { title: '봄봄', n: 1 }],
    });
    expect(parsed.sources).toHaveLength(1);
    expect(parsed.area_paths).toEqual([['문학']]);
    expect(parsed.grammar_paths).toEqual([{ paths: ['음운'], n: 2 }]);
    expect(parsed.work_titles).toEqual([{ titles: ['봄봄'], n: 2 }]);
    // 지은이·영역이 없는 지문 작품은 빈 값으로 받는다(영역 없는 지문도 '모름' 으로 세야 한다)
    expect(parsed.passage_works).toEqual([{ title: '봄봄', author: '', area_path: [], n: 1 }]);
  });
});
