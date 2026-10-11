import { describe, it, expect } from 'vitest';
import { EMPTY_FILTERS } from './filters';
import {
  GRAMMAR_SOLO_PASSAGE_AREAS, SOLO_LABELS, soloApplies, soloAxisOf, soloToggleLabel,
} from './solo-filter';

describe('solo-filter', () => {
  it('축이 없으면 칸을 그리지 않는다', () => {
    expect(soloAxisOf(EMPTY_FILTERS)).toBeNull();
    expect(soloToggleLabel(EMPTY_FILTERS)).toBeNull();
  });

  it('작품 축이면 작품 이름, 문법 축이면 문법 이름', () => {
    expect(soloToggleLabel({ ...EMPTY_FILTERS, work_title: '서시' })).toBe(SOLO_LABELS.work);
    expect(soloToggleLabel({ ...EMPTY_FILTERS, grammar_path: ['음운'] })).toBe(SOLO_LABELS.grammar);
  });

  it('둘 다 걸리면 작품이 먼저다', () => {
    expect(soloAxisOf({ ...EMPTY_FILTERS, work_title: '서시', grammar_path: ['음운'] })).toBe('work');
  });

  it('켜져 있고 축이 있어야만 조건이다', () => {
    expect(soloApplies({ ...EMPTY_FILTERS, solo: true })).toBe(false);
    expect(soloApplies({ ...EMPTY_FILTERS, work_title: '서시' })).toBe(false);
    expect(soloApplies({ ...EMPTY_FILTERS, work_title: '서시', solo: true })).toBe(true);
  });

  it("문법 단독은 화법과 언어 지문 + 지문 없음('') 이고, 빈 값이 뒤에 온다", () => {
    expect(GRAMMAR_SOLO_PASSAGE_AREAS).toEqual(['화법과 언어', '']);
  });
});
