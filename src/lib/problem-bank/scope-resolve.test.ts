import { describe, it, expect } from 'vitest';
import { toScopeHint } from './scope-resolve';
import { toScopeWanted } from './scope-pick';
import type { PublicTextbook, SchoolScopeRow } from '@/lib/naesin-scope/types';

const row = (over: Partial<SchoolScopeRow> = {}): SchoolScopeRow => ({
  grade: '중2', year: 2026, semester: 1, exam_type: '중간',
  textbook_id: 'tb1', units: ['1. 문학'], noExam: false, ...over,
});
const textbook = (over: Partial<PublicTextbook> = {}): PublicTextbook => ({
  id: 'tb1', school_level: '중등', grade: '중2', publisher: '천재 (노미숙)',
  book_title: '국어 2-1', ...over,
});
const wanted = toScopeWanted({ grade: '중2', year: '2026', semester: '1학기', examType: '중간' });
const names = ['천재(노미숙)', '동아'];

/** 고른 행·교과서만 바꿔 가며 부르는 얇은 래퍼 */
const hint = (rows: SchoolScopeRow[], chosen: SchoolScopeRow | null, tb: PublicTextbook | null) =>
  toScopeHint({ rows, wanted, chosen, textbook: tb, textbookNames: names });

describe('toScopeHint', () => {
  it('정확한 슬롯이면 범위와 교과서를 함께 준다', () => {
    const rows = [row()];
    const h = hint(rows, rows[0], textbook())!;
    expect(h.exact).toBe(true);
    expect(h.units).toEqual(['1. 문학']);
    expect(h.matchedTextbook).toBe('천재(노미숙)');
    expect(h.basis).toEqual({ grade: '중2', year: 2026, semester: 1, examType: '중간' });
  });

  it('등록된 교과서를 이 앱 표기로 맞춰 준다 — 괄호 앞 공백이 흔히 다르다', () => {
    const rows = [row()];
    const h = hint(rows, rows[0], textbook())!;
    expect(h.textbookName).toBe('천재 (노미숙)');
    expect(h.matchedTextbook).toBe('천재(노미숙)');
  });

  it('정확한 슬롯이 없으면 교과서만 빌리고 범위는 비운다 — 다른 해의 단원은 이번 범위가 아니다', () => {
    const rows = [row({ year: 2024, units: ['옛 범위'] })];
    const h = hint(rows, rows[0], textbook())!;
    expect(h.exact).toBe(false);
    expect(h.units).toEqual([]);
    expect(h.matchedTextbook).toBe('천재(노미숙)');
    expect(h.basis?.year).toBe(2024);
  });

  it("'안 보는 시험' 슬롯의 범위는 쓰지 않지만 다른 행의 교과서는 채운다", () => {
    const rows = [row({ noExam: true, units: ['옛 범위'] }), row({ year: 2025 })];
    const h = hint(rows, rows[1], textbook())!;
    expect(h.noExam).toBe(true);
    expect(h.units).toEqual([]);
    expect(h.matchedTextbook).toBe('천재(노미숙)');
    expect(h.exact).toBe(false);
  });

  it('마스터에 없는 교과서면 이름만 알려 준다 — 조용히 비우지 않는다', () => {
    const rows = [row()];
    const h = hint(rows, rows[0], textbook({ publisher: '없는출판사' }))!;
    expect(h.textbookName).toBe('없는출판사');
    expect(h.matchedTextbook).toBeNull();
  });

  it('교과서가 연결되지 않은 정확한 슬롯도 단원 힌트는 준다', () => {
    const rows = [row({ textbook_id: null })];
    const h = hint(rows, null, null)!;
    expect(h.units).toEqual(['1. 문학']);
    expect(h.matchedTextbook).toBeNull();
    expect(h.basis).toBeNull();
    expect(h.exact).toBe(false);
  });

  it('교과서를 못 읽어 오면 기준도 남기지 않는다 — 없는 근거를 적으면 안 된다', () => {
    const rows = [row()];
    const h = hint(rows, rows[0], null)!;
    expect(h.textbookName).toBeNull();
    expect(h.basis).toBeNull();
  });

  it('그 학교에 등록된 슬롯이 하나도 없으면 null', () => {
    expect(hint([], null, null)).toBeNull();
  });
});
