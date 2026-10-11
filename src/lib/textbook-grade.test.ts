import { describe, it, expect } from 'vitest';
import { NO_GRADE_OPTION, gradeOptionsFor, textbookGradeLabel, toStoredGrade } from './textbook-grade';

describe('gradeOptionsFor', () => {
  it('중등은 학년별 권뿐이다', () => {
    expect(gradeOptionsFor('중등')).toEqual(['중1', '중2', '중3']);
  });

  it("고등은 '선택과목' 을 더 내준다 (고2·고3 어디서든 배우는 선택과목)", () => {
    expect(gradeOptionsFor('고등')).toEqual(['고1', '고2', '고3', NO_GRADE_OPTION]);
  });
});

describe('표시값 ↔ 저장값', () => {
  it("'선택과목' 은 빈 문자열로 저장한다", () => {
    expect(toStoredGrade(NO_GRADE_OPTION)).toBe('');
  });

  it('학년과 아직 안 고른 값은 그대로', () => {
    expect(toStoredGrade('고2')).toBe('고2');
    expect(toStoredGrade('')).toBe('');
  });
});

describe('textbookGradeLabel', () => {
  it("빈 학년 고등 교과서는 '선택과목'", () => {
    expect(textbookGradeLabel('', '고등')).toBe('선택과목');
  });

  it("중등이나 학교급을 모르면 '미지정' — 중등에는 선택과목이 없다", () => {
    expect(textbookGradeLabel('', '중등')).toBe('미지정');
    expect(textbookGradeLabel('')).toBe('미지정');
  });

  it('학년이 있으면 그대로', () => {
    expect(textbookGradeLabel('고2', '고등')).toBe('고2');
  });
});
