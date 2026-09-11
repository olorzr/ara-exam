import { describe, it, expect } from 'vitest';
import type { SchoolScopeRow } from '@/lib/naesin-scope/types';
import {
  canBorrowAcrossGrades, describeBasis, findExactSlot, pickTextbookRow, semesterDigit,
  toScopeBasis, toScopeWanted,
} from './scope-pick';

const row = (over: Partial<SchoolScopeRow> = {}): SchoolScopeRow => ({
  grade: '중2', year: 2026, semester: 1, exam_type: '중간',
  textbook_id: 'tb1', units: [], noExam: false, ...over,
});

const wanted = (over: Partial<ReturnType<typeof toScopeWanted>> = {}) => ({
  grade: '중2', year: 2026, semester: 1 as const, examType: '중간' as const, ...over,
});

describe('semesterDigit', () => {
  it('표시값에서 숫자를 뽑는다', () => {
    expect(semesterDigit('1학기')).toBe(1);
    expect(semesterDigit('2학기')).toBe(2);
  });

  it('미지정이면 null', () => {
    expect(semesterDigit('')).toBeNull();
    expect(semesterDigit('미지정')).toBeNull();
  });
});

describe('toScopeWanted', () => {
  it('학년도는 네 자리 숫자일 때만 숫자다 — Number("") 은 0 이라 그냥 두면 0학년도를 찾는다', () => {
    expect(toScopeWanted({ grade: '중2', year: '', semester: '1학기', examType: '중간' }).year).toBeNull();
    expect(toScopeWanted({ grade: '중2', year: '미지정', semester: '', examType: '' }).year).toBeNull();
    expect(toScopeWanted({ grade: '중2', year: '26', semester: '', examType: '' }).year).toBeNull();
    expect(toScopeWanted({ grade: '중2', year: '2024', semester: '', examType: '' }).year).toBe(2024);
  });

  it('학기·시험도 아는 값일 때만 담는다', () => {
    const w = toScopeWanted({ grade: '중2', year: '2026', semester: '2학기', examType: '기말' });
    expect(w).toEqual({ grade: '중2', year: 2026, semester: 2, examType: '기말' });
    expect(toScopeWanted({ grade: '', year: '', semester: '미지정', examType: '미지정' }))
      .toEqual({ grade: '', year: null, semester: null, examType: null });
  });
});

describe('findExactSlot', () => {
  it('다섯 키가 다 맞는 행만 돌려준다', () => {
    const rows = [row({ year: 2025 }), row()];
    expect(findExactSlot(rows, wanted())).toBe(rows[1]);
  });

  it('조건이 하나라도 미지정이면 null — 슬롯 키가 모자라 특정할 수 없다', () => {
    expect(findExactSlot([row()], wanted({ year: null }))).toBeNull();
    expect(findExactSlot([row()], wanted({ grade: '' }))).toBeNull();
    expect(findExactSlot([row()], wanted({ semester: null }))).toBeNull();
    expect(findExactSlot([row()], wanted({ examType: null }))).toBeNull();
  });

  it('맞는 행이 없으면 null', () => {
    expect(findExactSlot([row({ year: 2025 })], wanted())).toBeNull();
  });
});

describe('canBorrowAcrossGrades', () => {
  it('중학교는 다른 학년에서 빌린다 — 한 학교가 한 교과서를 쓴다', () => {
    expect(canBorrowAcrossGrades('중1')).toBe(true);
  });

  it('고등학교는 안 빌린다 — 학년마다 책이 다르다', () => {
    expect(canBorrowAcrossGrades('고2')).toBe(false);
  });

  it('학년 미지정이면 어느 학년이든 힌트가 된다', () => {
    expect(canBorrowAcrossGrades('')).toBe(true);
  });
});

describe('pickTextbookRow', () => {
  it('정확히 맞는 행이 있으면 그 행이다', () => {
    const exact = row();
    const rows = [row({ year: 2025, exam_type: '기말' }), exact];
    expect(pickTextbookRow(rows, wanted())).toBe(exact);
  });

  it('그 학년도 행이 없으면 가장 가까운 학년도를 쓴다 — 2024 기출에 2026 행만 있어도 채운다', () => {
    const rows = [row({ year: 2026 })];
    expect(pickTextbookRow(rows, wanted({ year: 2024 }))).toBe(rows[0]);
  });

  it('학년도 거리가 같으면 최근 학년도를 쓴다', () => {
    const rows = [row({ year: 2024 }), row({ year: 2026 })];
    expect(pickTextbookRow(rows, wanted({ year: 2025 }))?.year).toBe(2026);
  });

  it('학년도가 미지정이면 최근 학년도를 쓴다', () => {
    const rows = [row({ year: 2024 }), row({ year: 2026 })];
    expect(pickTextbookRow(rows, wanted({ year: null }))?.year).toBe(2026);
  });

  it('학년이 먼저고 그다음이 학년도다 — 다른 학년의 같은 해보다 같은 학년의 다른 해가 낫다', () => {
    const rows = [row({ grade: '중3', year: 2026 }), row({ grade: '중2', year: 2023 })];
    expect(pickTextbookRow(rows, wanted({ year: 2026 }))?.grade).toBe('중2');
  });

  it('같은 학기·같은 시험을 먼저 본다', () => {
    const rows = [row({ semester: 2, exam_type: '기말' }), row({ semester: 1, exam_type: '기말' })];
    expect(pickTextbookRow(rows, wanted())).toBe(rows[1]);
  });

  it('나머지가 같으면 중간을 기말보다 먼저 본다 — 학기 대표 교과서 규칙과 같다', () => {
    const rows = [row({ exam_type: '기말' }), row({ exam_type: '중간' })];
    expect(pickTextbookRow(rows, wanted({ examType: null }))?.exam_type).toBe('중간');
  });

  it("'안 보는 시험' 행과 교과서 없는 행은 후보에서 뺀다 — 잠긴 옛 값이다", () => {
    const rows = [row({ noExam: true }), row({ textbook_id: null })];
    expect(pickTextbookRow(rows, wanted())).toBeNull();
  });

  it('중학교는 다른 학년 행에서도 빌려 온다', () => {
    const rows = [row({ grade: '중3', textbook_id: 'tb3' })];
    expect(pickTextbookRow(rows, wanted({ grade: '중1' }))?.textbook_id).toBe('tb3');
  });

  it('고등학교는 다른 학년에서 빌리지 않는다', () => {
    const rows = [row({ grade: '고1' })];
    expect(pickTextbookRow(rows, wanted({ grade: '고2' }))).toBeNull();
  });

  it('중1 1학기를 골라도 2학기 행에서 빌려 온다 — 자유학기제라 1학기 슬롯이 없다', () => {
    const rows = [row({ grade: '중1', semester: 2, exam_type: '기말' })];
    expect(pickTextbookRow(rows, wanted({ grade: '중1' }))).toBe(rows[0]);
  });

  it('후보가 하나도 없으면 null', () => {
    expect(pickTextbookRow([], wanted())).toBeNull();
  });
});

describe('describeBasis', () => {
  it('기준 슬롯을 한 줄로 적는다 — 무엇을 보고 채웠는지 밝혀야 고칠 수 있다', () => {
    expect(describeBasis(toScopeBasis(row({ grade: '중1', year: 2026, semester: 2 }))))
      .toBe('2026 중1 2학기 중간');
  });
});
