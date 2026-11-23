import { describe, expect, it } from 'vitest';
import { INTAKE_SOURCE_LABEL_MAX, intakeSourceLabel, sliceUnits } from './intake-label';

describe('intakeSourceLabel', () => {
  it('짧으면 원래 번호를 붙인 그대로', () => {
    expect(intakeSourceLabel('2026 중2 상현중 1학기 중간', 17)).toBe('2026 중2 상현중 1학기 중간 · 원래 17번');
    expect(intakeSourceLabel('', 3)).toBe('원래 3번');
    expect(intakeSourceLabel('제목', null)).toBe('제목');
  });

  it('길면 앞 출처만 줄이고 원래 번호 꼬리는 지킨다(인테이크 상한 안)', () => {
    const title = '가'.repeat(120);
    const out = intakeSourceLabel(title, 35);
    expect(out.length).toBe(INTAKE_SOURCE_LABEL_MAX);
    expect(out.endsWith('… · 원래 35번')).toBe(true);
    // 끝의 과목 꼬리는 지킨다 — 같은 시험의 화작·언매가 같은 글이 되지 않게
    const mockTitle = `${'2026학년도 대학수학능력시험 국어영역 '.repeat(3)}(언어와 매체)`;
    const withSection = intakeSourceLabel(mockTitle, 35);
    expect(withSection.length).toBeLessThanOrEqual(INTAKE_SOURCE_LABEL_MAX);
    expect(withSection.endsWith('… (언어와 매체) · 원래 35번')).toBe(true);
    expect(intakeSourceLabel(mockTitle.replace('언어와 매체', '화법과 작문'), 35)).not.toBe(withSection);
    // 겹괄호 꼬리도 통째로 지킨다(A형·B형이 같은 글이 되지 않게)
    const nested = `${'2014학년도 대학수학능력시험 '.repeat(4)}(국어 영역 (A형))`;
    const nestedA = intakeSourceLabel(nested, 12);
    expect(nestedA.endsWith('… (국어 영역 (A형)) · 원래 12번')).toBe(true);
    expect(nestedA.length).toBeLessThanOrEqual(INTAKE_SOURCE_LABEL_MAX);
    expect(intakeSourceLabel(nested.replace('A형', 'B형'), 12)).not.toBe(nestedA);
    // 꼬리가 너무 길어 앞이 안 남으면 꼬리를 포기한다
    const longSection = `시험 (${'가'.repeat(80)})`;
    expect(intakeSourceLabel(longSection, 3).startsWith('시험 (')).toBe(true);
    const noNumber = intakeSourceLabel(title, null);
    expect(noNumber.length).toBe(INTAKE_SOURCE_LABEL_MAX);
    expect(noNumber.endsWith('…')).toBe(true);
  });
});

describe('글자 경계 자르기', () => {
  it('보충 평면 글자(이모지)를 반으로 가르지 않는다', () => {
    expect(sliceUnits('가😀나', 2)).toBe('가');
    expect(sliceUnits('가😀나', 3)).toBe('가😀');
    const out = intakeSourceLabel(`${'가'.repeat(60)}😀${'나'.repeat(40)}`, 3);
    expect(out.length).toBeLessThanOrEqual(INTAKE_SOURCE_LABEL_MAX);
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(out)).toBe(false);
  });
});
