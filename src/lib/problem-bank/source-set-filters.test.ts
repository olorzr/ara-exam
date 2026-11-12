import { describe, expect, it } from 'vitest';
import { ALL_AXIS } from './filter-axes';
import {
  EMPTY_SET_FILTERS, filterSourceSets, hasActiveSetFilters, setFiltersFromParams, setFiltersToQueryString,
  setNameMatcher, setYearOptions, toSetKind,
} from './source-set-filters';
import type { SourceSet } from './source-sets';

function set(over: Partial<SourceSet>): SourceSet {
  return {
    source_type: '내신기출', year: '2026', grade: '중2', semester: '1학기', exam_type: '중간', textbook: '',
    publisher: '', exam_count: 1, names: ['무학중학교'], ...over,
  };
}

const sets = [
  set({}),
  set({ grade: '고1', names: ['성수고등학교', '무학여자고등학교'] }),
  set({ year: '2025', names: ['광희중학교'] }),
  set({ source_type: '모의고사', grade: '고3', semester: '', exam_type: '수능', publisher: '평가원', names: ['2026학년도 수능 (공통)'] }),
];

describe('filterSourceSets', () => {
  it('조건이 없으면 전부', () => {
    expect(filterSourceSets(sets, EMPTY_SET_FILTERS)).toHaveLength(4);
  });

  it('구분 — 중등·고등은 내신만, 모의고사는 모의고사만', () => {
    expect(filterSourceSets(sets, { ...EMPTY_SET_FILTERS, kind: '중등' })).toHaveLength(2);
    expect(filterSourceSets(sets, { ...EMPTY_SET_FILTERS, kind: '고등' }).map((s) => s.grade)).toEqual(['고1']);
    expect(filterSourceSets(sets, { ...EMPTY_SET_FILTERS, kind: '모의고사' }).map((s) => s.exam_type)).toEqual(['수능']);
  });

  it('학년도', () => {
    expect(filterSourceSets(sets, { ...EMPTY_SET_FILTERS, year: '2025' })).toHaveLength(1);
  });

  it('학교 이름은 공백을 무시하고 일부만 맞아도 걸린다', () => {
    expect(filterSourceSets(sets, { ...EMPTY_SET_FILTERS, q: '무학' })).toHaveLength(2);
    expect(filterSourceSets(sets, { ...EMPTY_SET_FILTERS, q: '무학 여자' })).toHaveLength(1);
    expect(filterSourceSets(sets, { ...EMPTY_SET_FILTERS, q: '  ' })).toHaveLength(4);
  });
});

describe('setNameMatcher', () => {
  it('비었으면 함수가 없다 — 카드가 이름 차례를 안 바꾼다', () => {
    expect(setNameMatcher('')).toBeUndefined();
    expect(setNameMatcher('광희')!('광희중학교')).toBe(true);
  });
});

describe('setYearOptions', () => {
  it('있는 학년도만 최근부터, 맨 앞은 전체', () => {
    expect(setYearOptions(sets).map((o) => o.value)).toEqual([ALL_AXIS, '2026', '2025']);
  });
});

describe('주소', () => {
  it('왕복한다 — 조건이 없으면 빈 글자', () => {
    const filters = { kind: '고등' as const, year: '2026', q: '무학' };
    expect(setFiltersFromParams(new URLSearchParams(setFiltersToQueryString(filters).slice(1)))).toEqual(filters);
    expect(setFiltersToQueryString(EMPTY_SET_FILTERS)).toBe('');
  });

  it('모르는 구분은 전체로 읽는다', () => {
    expect(setFiltersFromParams(new URLSearchParams('kind=초등')).kind).toBe('');
    expect(toSetKind(ALL_AXIS)).toBe('');
    expect(toSetKind('모의고사')).toBe('모의고사');
  });

  it('조건이 있는가', () => {
    expect(hasActiveSetFilters(EMPTY_SET_FILTERS)).toBe(false);
    expect(hasActiveSetFilters({ ...EMPTY_SET_FILTERS, q: ' ' })).toBe(false);
    expect(hasActiveSetFilters({ ...EMPTY_SET_FILTERS, year: '2026' })).toBe(true);
  });
});
