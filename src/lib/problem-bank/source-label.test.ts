import { describe, it, expect } from 'vitest';
import { sourceLabel, sourceLabelWithType, type SourceLabelInput } from './source-label';

function source(over: Partial<SourceLabelInput> = {}): SourceLabelInput {
  return {
    source_type: '내신기출', title: '상현중 2026 1학기 중간', school_name: '상현중',
    year: '2026', grade: '중2', semester: '1학기', exam_type: '중간', publisher: '',
    ...over,
  };
}

describe('sourceLabel', () => {
  it('년도 · 학년 · 학교 · 학기 · 시험 차례로 잇는다', () => {
    expect(sourceLabel(source())).toBe('2026 중2 상현중 1학기 중간');
  });

  /**
   * ⚠️ 학기가 빠지면 그 학교의 1학기 중간과 2학기 중간을 구분할 수 없다 —
   *    아카이브에 학기 필터 축이 따로 있는 것도 그래서다.
   */
  it('학기가 자리를 지킨다 — 시험 앞', () => {
    expect(sourceLabel(source({ semester: '2학기' }))).toContain('2학기 중간');
  });

  /** sql/35 전에 만든 문제지의 스냅샷에는 학기 키가 아예 없다 */
  it('학기가 없는 옛 스냅샷은 학기만 빠진 채로 그려진다', () => {
    const legacy = { ...source() };
    delete legacy.semester;
    expect(sourceLabel(legacy)).toBe('2026 중2 상현중 중간');
  });

  it('학교가 없으면 출판사를 쓴다', () => {
    expect(sourceLabel(source({ school_name: '', publisher: '천재' }))).toContain('천재');
  });

  it('적을 것이 하나도 없으면 제목으로 물러선다', () => {
    const bare = source({
      school_name: '', publisher: '', year: '', grade: '', semester: '', exam_type: '',
      title: '문제집 3단원',
    });
    expect(sourceLabel(bare)).toBe('문제집 3단원');
  });
});

describe('sourceLabelWithType', () => {
  it('유형을 앞에 붙인다', () => {
    expect(sourceLabelWithType(source())).toBe('내신기출 · 2026 중2 상현중 1학기 중간');
  });
});
