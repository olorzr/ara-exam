import { describe, it, expect } from 'vitest';
import { semesterDigit, toScopeHint } from './scope-resolve';
import type { PublicTextbook, ScopeSlotRow } from '@/lib/naesin-scope/types';

const slot = (over: Partial<ScopeSlotRow> = {}): ScopeSlotRow => ({
  scope: null, teacher_name: null, textbook_id: 'tb1', units: ['1. 문학'],
  exam_start_date: null, exam_end_date: null, korean_exam_date: null, noExam: false, ...over,
});
const textbook = (over: Partial<PublicTextbook> = {}): PublicTextbook => ({
  id: 'tb1', school_level: '중등', grade: '중2', publisher: '천재 (노미숙)',
  book_title: '국어 2-1', ...over,
});

describe('semesterDigit', () => {
  it('표시값에서 숫자를 뽑는다', () => {
    expect(semesterDigit('1학기')).toBe(1);
    expect(semesterDigit('2학기')).toBe(2);
  });

  it('미지정이면 null — 슬롯 키가 모자라 조회할 수 없다', () => {
    expect(semesterDigit('')).toBeNull();
    expect(semesterDigit('미지정')).toBeNull();
  });
});

describe('toScopeHint', () => {
  it('등록된 교과서를 이 앱 표기로 맞춰 준다 — 괄호 앞 공백이 흔히 다르다', () => {
    const hint = toScopeHint(slot(), textbook(), ['천재(노미숙)', '동아'])!;
    expect(hint.textbookName).toBe('천재 (노미숙)');
    expect(hint.matchedTextbook).toBe('천재(노미숙)');
    expect(hint.units).toEqual(['1. 문학']);
  });

  it('마스터에 없는 교과서면 이름만 알려 준다 — 조용히 비우지 않는다', () => {
    const hint = toScopeHint(slot(), textbook({ publisher: '없는출판사' }), ['동아'])!;
    expect(hint.textbookName).toBe('없는출판사');
    expect(hint.matchedTextbook).toBeNull();
  });

  it("'안 보는 시험'은 남아 있는 범위를 쓰지 않는다 — 잠긴 옛 값이다", () => {
    const hint = toScopeHint(slot({ noExam: true, units: ['옛 범위'] }), textbook(), ['천재(노미숙)'])!;
    expect(hint.noExam).toBe(true);
    expect(hint.units).toEqual([]);
    expect(hint.matchedTextbook).toBeNull();
  });

  it('교과서가 연결되지 않은 슬롯도 단원 힌트는 준다', () => {
    const hint = toScopeHint(slot({ textbook_id: null }), null, ['동아'])!;
    expect(hint.matchedTextbook).toBeNull();
    expect(hint.units).toEqual(['1. 문학']);
  });

  it('등록된 슬롯이 없으면 null', () => {
    expect(toScopeHint(null, null, [])).toBeNull();
  });
});
