import { describe, expect, it } from 'vitest';
import { ALL_AXIS } from './filter-axes';
import { EMPTY_SOURCE_FACETS, type SourceFacets } from './facets';
import { UNSPECIFIED_AXIS } from './filters';
import {
  buildSourceAxes, EMPTY_SOURCE_LIST_FILTERS, hasActiveSourceFilters, parseSourceSort,
  SOURCE_FILTER_AXES, sourceListFiltersFromParams, sourceListFiltersToQueryString,
  toSourceListQuery, type SourceListFilters,
} from './source-list-filters';

const filters = (patch: Partial<SourceListFilters> = {}): SourceListFilters => ({
  ...EMPTY_SOURCE_LIST_FILTERS, ...patch,
});

const facets = (patch: Partial<SourceFacets> = {}): SourceFacets => ({
  ...EMPTY_SOURCE_FACETS,
  schools: ['상현중', '성수고'],
  years: ['2026', '2025'],
  grades: ['고1', '중2'],
  textbooks: ['천재(노미숙)'],
  semesters: ['1학기', '2학기'],
  schoolsByLevel: { 중등: ['상현중'], 고등: ['성수고'] },
  ...patch,
});

describe('주소 ↔ 필터', () => {
  it('왕복해도 같은 값이다', () => {
    const source = filters({
      source_type: '내신기출', school_level: '중등', school_name: '상현중', year: '2026',
      grade: '중2', semester: '1학기', exam_type: '중간', textbook: '천재(노미숙)',
      title: '봄봄', sort: 'exam',
    });
    const back = sourceListFiltersFromParams(
      new URLSearchParams(sourceListFiltersToQueryString(source).slice(1)),
    );
    expect(back).toEqual(source);
  });

  it('아무 조건도 없고 기본 차례면 빈 문자열이다', () => {
    expect(sourceListFiltersToQueryString(EMPTY_SOURCE_LIST_FILTERS)).toBe('');
  });

  it('아카이브와 같은 키를 쓴다 — 제목 검색은 q 자리다', () => {
    const query = sourceListFiltersToQueryString(filters({ school_name: '상현중', title: '봄' }));
    const params = new URLSearchParams(query.slice(1));
    expect(params.get('school')).toBe('상현중');
    expect(params.get('q')).toBe('봄');
  });

  it('아카이브 전용 키(작품·영역·쪽)는 버린다', () => {
    const back = sourceListFiltersFromParams(new URLSearchParams('work=동백꽃&area=문학&page=3&year=2026'));
    expect(back).toEqual(filters({ year: '2026' }));
  });

  it('모르는 차례는 최근 올린 순이다', () => {
    expect(parseSourceSort('oldest')).toBe('recent');
    expect(parseSourceSort(null)).toBe('recent');
    expect(parseSourceSort('exam')).toBe('exam');
  });
});

describe('toSourceListQuery', () => {
  it('걸린 칸만 싣는다', () => {
    expect(toSourceListQuery(EMPTY_SOURCE_LIST_FILTERS)).toEqual({ sort: 'recent' });
    expect(toSourceListQuery(filters({ school_name: '상현중', title: '  봄봄 ' })))
      .toEqual({ school_name: '상현중', title: '봄봄', sort: 'recent' });
  });

  it("'미지정만' 은 빈 값 조건이 된다 — 아카이브와 같은 규칙이다", () => {
    expect(toSourceListQuery(filters({ year: UNSPECIFIED_AXIS })).year).toBe('');
    expect(toSourceListQuery(filters({ grade: UNSPECIFIED_AXIS })).grade).toBe('');
  });

  it('학교급은 그 학교급의 학년들로 편다', () => {
    expect(toSourceListQuery(filters({ school_level: '중등' })).grades).toEqual(['중1', '중2', '중3']);
  });
});

describe('hasActiveSourceFilters', () => {
  it('칸이나 제목이 걸렸을 때만 true — 차례는 조건이 아니다', () => {
    expect(hasActiveSourceFilters(EMPTY_SOURCE_LIST_FILTERS)).toBe(false);
    expect(hasActiveSourceFilters(filters({ sort: 'exam' }))).toBe(false);
    expect(hasActiveSourceFilters(filters({ title: '   ' }))).toBe(false);
    expect(hasActiveSourceFilters(filters({ title: '봄' }))).toBe(true);
    expect(hasActiveSourceFilters(filters({ exam_type: '기말' }))).toBe(true);
  });
});

describe('buildSourceAxes', () => {
  it('출처 칸만, 정해진 차례로 그린다 — 문항 칸(작품·영역·문법·문항 유형)은 없다', () => {
    const keys = buildSourceAxes(EMPTY_SOURCE_LIST_FILTERS, facets()).map((a) => a.key);
    expect(keys).toEqual([...SOURCE_FILTER_AXES]);
  });

  it('선택지가 없는 학기·교과서 칸은 숨긴다(아카이브 규칙 그대로)', () => {
    const keys = buildSourceAxes(
      EMPTY_SOURCE_LIST_FILTERS, facets({ semesters: [], textbooks: [] }),
    ).map((a) => a.key);
    expect(keys).not.toContain('semester');
    expect(keys).not.toContain('textbook');
  });

  it('패치에는 이 목록의 키만 담긴다 — 아카이브의 쪽 번호가 새지 않는다', () => {
    const year = buildSourceAxes(EMPTY_SOURCE_LIST_FILTERS, facets()).find((a) => a.key === 'year')!;
    expect(year.toPatch('2026')).toEqual({ year: '2026' });
    expect(year.toPatch(ALL_AXIS)).toEqual({ year: '' });
  });

  it('학교급을 바꾸면 어긋나는 학교·학년을 비운다(아카이브 규칙 그대로)', () => {
    const level = buildSourceAxes(
      filters({ school_name: '성수고', grade: '고1' }), facets(),
    ).find((a) => a.key === 'school_level')!;
    expect(level.toPatch('중등')).toEqual({ school_level: '중등', school_name: '', grade: '' });
  });

  it('학교급이 걸리면 학교 칸이 그 학교급 학교로 좁혀진다', () => {
    const school = buildSourceAxes(filters({ school_level: '고등' }), facets())
      .find((a) => a.key === 'school_name')!;
    expect(school.options.map((o) => o.value)).toEqual([ALL_AXIS, '성수고']);
  });
});
