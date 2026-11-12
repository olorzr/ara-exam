import { describe, expect, it } from 'vitest';
import { filtersFromParams, UNSPECIFIED_AXIS } from './filters';
import { examViewHref, setArchiveHref, setFromParams, setSourceQuery, setViewHref } from './source-set-link';
import type { SourceSetKey } from './source-sets';

const school: SourceSetKey = {
  source_type: '내신기출', year: '2026', grade: '중2', semester: '1학기', exam_type: '중간',
  textbook: '비상(박영민)', publisher: '',
};
const kice: SourceSetKey = {
  source_type: '모의고사', year: '2027', grade: '고3', semester: '', exam_type: '6월 모평', textbook: '', publisher: '평가원',
};
const hakpyeong: SourceSetKey = { ...kice, grade: '고1', exam_type: '3월 학평', publisher: '교육청' };

/** 주소의 쿼리만 */
function paramsOf(href: string): URLSearchParams {
  return new URLSearchParams(href.slice(href.indexOf('?') + 1));
}

describe('setViewHref ↔ setFromParams', () => {
  it('세트 칸이 그대로 돌아온다 — 교과서 빈 값도 "빈 값" 으로', () => {
    for (const set of [school, { ...school, textbook: '' }, kice, hakpyeong]) {
      expect(setFromParams(paramsOf(setViewHref(set)))).toEqual(set);
    }
    expect(paramsOf(setViewHref({ ...school, textbook: '' })).get('book')).toBe('');
  });

  it('평가원 회차는 학년이 비어 와도 고3 세트다', () => {
    expect(setFromParams(new URLSearchParams('type=모의고사&year=2027&grade=&exam=6월 모평&board=평가원'))?.grade).toBe('고3');
  });

  it('세트 유형이 아니면 null', () => {
    expect(setFromParams(new URLSearchParams('type=평가문제집&year=2026'))).toBeNull();
    expect(setFromParams(new URLSearchParams(''))).toBeNull();
  });
});

describe('setSourceQuery', () => {
  it('내신은 교과서 빈 값까지 그대로 싣는다(= 빈 출처만)', () => {
    expect(setSourceQuery({ ...school, textbook: '' })).toEqual({
      sort: 'exam', source_type: '내신기출', year: '2026', grade: '중2', semester: '1학기', exam_type: '중간', textbook: '',
    });
  });

  it('평가원 회차는 학년을 걸지 않고, 학평은 건다. 모의고사는 학기·교과서를 걸지 않는다', () => {
    const k = setSourceQuery(kice);
    expect(k).toEqual({ sort: 'exam', source_type: '모의고사', year: '2027', exam_type: '6월 모평' });
    expect('grade' in k || 'semester' in k || 'textbook' in k).toBe(false);
    expect(setSourceQuery(hakpyeong).grade).toBe('고1');
  });
});

describe('setArchiveHref', () => {
  it('교과서가 빈 내신 세트는 아카이브로 못 넘긴다(아카이브는 교과서 "미지정만" 을 못 거른다)', () => {
    expect(setArchiveHref({ ...school, textbook: '' })).toBeNull();
  });

  it('내신은 학교를 비우고(전체) 교과서까지 건다', () => {
    const href = setArchiveHref(school)!;
    expect(href.startsWith('/problems/archive?')).toBe(true);
    const filters = filtersFromParams(paramsOf(href));
    expect(filters).toMatchObject({
      source_type: '내신기출', school_name: '', year: '2026', grade: '중2', semester: '1학기', exam_type: '중간',
      textbook: '비상(박영민)',
    });
  });

  it('모의고사는 회차 잎과 같은 필터다 — 평가원은 학년 전체', () => {
    const filters = filtersFromParams(paramsOf(setArchiveHref(kice)!));
    expect(filters).toMatchObject({ source_type: '모의고사', year: '2027', grade: '', exam_type: '6월 모평', textbook: '' });
    expect(filtersFromParams(paramsOf(setArchiveHref(hakpyeong)!)).grade).toBe('고1');
  });

  it('빈 학년도는 "미지정만" 으로 넘긴다', () => {
    expect(filtersFromParams(paramsOf(setArchiveHref({ ...school, year: '' })!)).year).toBe(UNSPECIFIED_AXIS);
  });
});

describe('examViewHref', () => {
  it('출처 id 를 경로에 싣는다', () => {
    expect(examViewHref('b80e83ae-908c')).toBe('/problems/sets/exam/b80e83ae-908c');
  });
});
