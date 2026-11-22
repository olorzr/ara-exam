import { describe, expect, it } from 'vitest';
import { EXAM_SHEET_TABS } from './exam-sheet-tabs';

describe('기출 시험지 탭', () => {
  it('세트로 보기 · 목록으로 보기 차례, 주소는 예전 두 화면 그대로', () => {
    expect(EXAM_SHEET_TABS.map((t) => [t.label, t.path])).toEqual([
      ['세트로 보기', '/problems/sets'],
      ['목록으로 보기', '/problems/sources'],
    ]);
  });
});
