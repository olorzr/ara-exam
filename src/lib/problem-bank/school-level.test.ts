import { describe, expect, it } from 'vitest';
import {
  collectSchoolsByLevel, gradeFitsSchoolLevel, gradesForSchoolLevel, parseSchoolLevel,
} from './school-level';

describe('gradesForSchoolLevel', () => {
  it('학교급의 학년 전부 — 미지정은 넣지 않는다', () => {
    expect(gradesForSchoolLevel('중등')).toEqual(['중1', '중2', '중3']);
    expect(gradesForSchoolLevel('고등')).toEqual(['고1', '고2', '고3']);
  });
});

describe('parseSchoolLevel', () => {
  it('아는 값만 받고 나머지는 전체로 본다', () => {
    expect(parseSchoolLevel('중등')).toBe('중등');
    expect(parseSchoolLevel('고등')).toBe('고등');
    expect(parseSchoolLevel('초등')).toBe('');
    expect(parseSchoolLevel(null)).toBe('');
  });
});

describe('gradeFitsSchoolLevel', () => {
  it('둘 중 하나가 전체면 늘 맞다', () => {
    expect(gradeFitsSchoolLevel('중2', '')).toBe(true);
    expect(gradeFitsSchoolLevel('', '고등')).toBe(true);
  });

  it('학년의 학교급이 같아야 맞다', () => {
    expect(gradeFitsSchoolLevel('고1', '고등')).toBe(true);
    expect(gradeFitsSchoolLevel('중2', '고등')).toBe(false);
  });

  it("'미지정만' 은 어느 학교급과도 안 맞는다", () => {
    expect(gradeFitsSchoolLevel('__none__', '중등')).toBe(false);
  });
});

describe('collectSchoolsByLevel', () => {
  it('학년 접두사로 학교를 나누고 학년이 빈 행은 뺀다', () => {
    expect(collectSchoolsByLevel([
      { school_name: '성수고', grade: '고2' },
      { school_name: '광희중', grade: '중1' },
      { school_name: '광희중', grade: '중3' },
      { school_name: '문제집학교', grade: '' },
      { school_name: '', grade: '중2' },
    ])).toEqual({ 중등: ['광희중'], 고등: ['성수고'] });
  });

  /** 한 학교에 두 학교급 출처가 있으면(중고 통합) 양쪽에 다 나온다 */
  it('두 학교급에 다 있으면 양쪽에 든다', () => {
    expect(collectSchoolsByLevel([
      { school_name: '통합학교', grade: '중3' },
      { school_name: '통합학교', grade: '고1' },
    ])).toEqual({ 중등: ['통합학교'], 고등: ['통합학교'] });
  });
});
