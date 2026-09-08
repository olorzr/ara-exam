import { describe, it, expect } from 'vitest';
import {
  EMPTY_FILTERS, filtersFromParams, filtersToQueryString, hasActiveFilters, toProblemQuery,
  UNSPECIFIED_AXIS,
} from './filters';

describe('filters ↔ 주소', () => {
  it('단원은 대단원 › 소단원을 한 칸에 싣는다', () => {
    const q = filtersToQueryString({ ...EMPTY_FILTERS, unit_path: ['1. 문학', '(1) 시'] });
    // URLSearchParams 는 공백을 '+' 로 싣는다 — 되읽을 때 그대로 복원된다
    expect(filtersFromParams(new URLSearchParams(q.slice(1))).unit_path)
      .toEqual(['1. 문학', '(1) 시']);
  });

  it('고른 조건만 싣는다', () => {
    const q = filtersToQueryString({ ...EMPTY_FILTERS, school_name: '상현중', year: '2026' });
    expect(q).toBe('?school=%EC%83%81%ED%98%84%EC%A4%91&year=2026');
  });

  it('아무 조건도 없으면 빈 문자열', () => {
    expect(filtersToQueryString(EMPTY_FILTERS)).toBe('');
  });

  it('왕복해도 같은 값이다', () => {
    const source = {
      ...EMPTY_FILTERS,
      source_type: '내신기출', school_name: '상현중', year: '2026', grade: '중2',
      semester: '1학기', exam_type: '중간', textbook: '천재(노미숙)', area_path: ['문학', '현대시'],
      unit_path: ['1. 문학', '(1) 시'], work_title: '동백꽃', search: '심상',
      verifiedOnly: true, page: 2,
    };
    const back = filtersFromParams(new URLSearchParams(filtersToQueryString(source).slice(1)));
    expect(back).toEqual(source);
  });

  it('작품은 work 로 싣고 되읽는다', () => {
    const q = filtersToQueryString({ ...EMPTY_FILTERS, work_title: '동백꽃' });
    expect(q).toContain('work=');
    expect(filtersFromParams(new URLSearchParams(q.slice(1))).work_title).toBe('동백꽃');
  });

  it('학기는 sem 으로 싣고 되읽는다', () => {
    const q = filtersToQueryString({ ...EMPTY_FILTERS, semester: '2학기' });
    expect(q).toContain('sem=');
    expect(filtersFromParams(new URLSearchParams(q.slice(1))).semester).toBe('2학기');
  });

  it('쪽 번호는 주소에서 1부터, 내부에서 0부터', () => {
    expect(filtersToQueryString({ ...EMPTY_FILTERS, page: 0 })).toBe('');
    expect(filtersToQueryString({ ...EMPTY_FILTERS, page: 2 })).toContain('page=3');
    expect(filtersFromParams(new URLSearchParams('page=3')).page).toBe(2);
  });

  it('이상한 쪽 번호는 첫 쪽으로', () => {
    expect(filtersFromParams(new URLSearchParams('page=abc')).page).toBe(0);
    expect(filtersFromParams(new URLSearchParams('page=-5')).page).toBe(0);
  });

  it('빈 주소는 빈 필터', () => {
    expect(filtersFromParams(new URLSearchParams(''))).toEqual(EMPTY_FILTERS);
  });
});

describe('toProblemQuery', () => {
  it('빈 값은 조건으로 만들지 않는다 — 빈 문자열 eq 는 미지정 행만 걸린다', () => {
    expect(toProblemQuery(EMPTY_FILTERS)).toEqual({ page: 0 });
  });

  it('검색어 앞뒤 공백을 다듬는다', () => {
    expect(toProblemQuery({ ...EMPTY_FILTERS, search: '  심상  ' }).search).toBe('심상');
    expect(toProblemQuery({ ...EMPTY_FILTERS, search: '   ' }).search).toBeUndefined();
  });

  it('영역은 배열 그대로 넘긴다', () => {
    expect(toProblemQuery({ ...EMPTY_FILTERS, area_path: ['문학'] }).area_path).toEqual(['문학']);
  });

  it('교과서와 단원도 조건이 된다', () => {
    const q = toProblemQuery({ ...EMPTY_FILTERS, textbook: '동아', unit_path: ['1. 문학'] });
    expect(q.textbook).toBe('동아');
    expect(q.unit_path).toEqual(['1. 문학']);
  });

  it('작품도 조건이 된다 — 자유 텍스트라 미지정만은 없다', () => {
    expect(toProblemQuery({ ...EMPTY_FILTERS, work_title: '동백꽃' }).work_title).toBe('동백꽃');
    expect('work_title' in toProblemQuery(EMPTY_FILTERS)).toBe(false);
    // 자유 텍스트 축이므로 센티널을 그 이름의 작품으로 본다
    expect(toProblemQuery({ ...EMPTY_FILTERS, work_title: UNSPECIFIED_AXIS }).work_title)
      .toBe(UNSPECIFIED_AXIS);
  });

  it("'미지정만' 은 빈 문자열 조건으로 나간다 — 빈 값(전체)과 반드시 구분돼야 한다", () => {
    const q = toProblemQuery({ ...EMPTY_FILTERS, semester: UNSPECIFIED_AXIS });
    expect(q.semester).toBe('');
    expect('semester' in q).toBe(true);
    // 전체는 아예 조건을 만들지 않는다
    expect('semester' in toProblemQuery(EMPTY_FILTERS)).toBe(false);
  });

  it('학년도·학년·시험도 미지정만 고를 수 있다', () => {
    const q = toProblemQuery({
      ...EMPTY_FILTERS,
      year: UNSPECIFIED_AXIS, grade: UNSPECIFIED_AXIS, exam_type: UNSPECIFIED_AXIS,
    });
    expect(q.year).toBe('');
    expect(q.grade).toBe('');
    expect(q.exam_type).toBe('');
  });

  it("자유 텍스트 축은 '__none__' 을 값 그대로 본다 — 그 이름의 학교·교과서가 있을 수 있다", () => {
    const q = toProblemQuery({
      ...EMPTY_FILTERS, school_name: UNSPECIFIED_AXIS, textbook: UNSPECIFIED_AXIS,
    });
    expect(q.school_name).toBe(UNSPECIFIED_AXIS);
    expect(q.textbook).toBe(UNSPECIFIED_AXIS);
  });

  it('학기도 조건이 된다', () => {
    expect(toProblemQuery({ ...EMPTY_FILTERS, semester: '1학기' }).semester).toBe('1학기');
    expect(toProblemQuery(EMPTY_FILTERS).semester).toBeUndefined();
  });
});

describe('hasActiveFilters', () => {
  it('조건이 있으면 true', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, search: '심상' })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, verifiedOnly: true })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, area_path: ['문학'] })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, textbook: '동아' })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, unit_path: ['1. 문학'] })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, semester: '1학기' })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, semester: UNSPECIFIED_AXIS })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, work_title: '동백꽃' })).toBe(true);
  });

  it('쪽 번호만으로는 조건이 아니다', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, page: 3 })).toBe(false);
  });
});
