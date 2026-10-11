import { describe, it, expect } from 'vitest';
import {
  NO_SEMESTER_OPTION, semesterOptionsFor, toSemesterOption, toStoredSemester,
} from './semester';

describe('semesterOptionsFor', () => {
  it('중등은 1·2학기뿐이다 — 중등 국어는 늘 학기별 권', () => {
    expect(semesterOptionsFor('중등')).toEqual(['1학기', '2학기']);
  });

  it("고등은 '학기 구분 없음' 을 더 내준다 (선택과목)", () => {
    expect(semesterOptionsFor('고등')).toEqual(['1학기', '2학기', NO_SEMESTER_OPTION]);
  });
});

describe('표시값 ↔ 저장값', () => {
  it("'학기 구분 없음' 은 빈 문자열로 저장한다", () => {
    expect(toStoredSemester(NO_SEMESTER_OPTION)).toBe('');
    expect(toSemesterOption('')).toBe(NO_SEMESTER_OPTION);
  });

  it('1·2학기와 아직 안 고른 값은 그대로', () => {
    expect(toStoredSemester('1학기')).toBe('1학기');
    expect(toSemesterOption('2학기')).toBe('2학기');
  });

  it('왕복이 같다', () => {
    for (const option of semesterOptionsFor('고등')) {
      expect(toSemesterOption(toStoredSemester(option))).toBe(option);
    }
  });
});
