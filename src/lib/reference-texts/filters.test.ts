import { describe, it, expect } from 'vitest';
import type { ReferenceUnit } from '@/types/reference-text';
import {
  ALL_REFERENCE_TEXTS, axisKey, describeAxis, tabForAxis, toReferenceTextQuery,
} from './filters';

const unit: ReferenceUnit = {
  grade: '중2', textbook: '천재(노미숙)', semester: '1학기', unit_path: ['1. 문학'],
};

describe('toReferenceTextQuery', () => {
  it('축이 없으면 조건도 없다', () => {
    expect(toReferenceTextQuery(ALL_REFERENCE_TEXTS)).toEqual({});
  });

  it('갈래마다 조건 하나', () => {
    expect(toReferenceTextQuery({ kind: 'unit', unit })).toEqual({ unit });
    expect(toReferenceTextQuery({ kind: 'unit-none' })).toEqual({ unitsEmpty: true });
    expect(toReferenceTextQuery({ kind: 'work', title: '봄봄' })).toEqual({ title: '봄봄' });
    expect(toReferenceTextQuery({ kind: 'grammar-none' })).toEqual({ grammarEmpty: true });
  });

  it('⚠️ 문법은 고른 마디와 그 아래 경로를 편다 — 상위 개념으로 찾으면 하위 태그도 걸려야 한다', () => {
    const paths = toReferenceTextQuery({ kind: 'grammar', path: ['단어', '품사'] }).grammar_paths ?? [];
    expect(paths[0]).toBe('단어 > 품사');
    expect(paths).toContain('단어 > 품사 > 명사');
  });
});

describe('axisKey', () => {
  it('같은 축이면 같은 열쇠, 다른 축이면 다른 열쇠', () => {
    expect(axisKey({ kind: 'unit', unit })).toBe(axisKey({ kind: 'unit', unit: { ...unit } }));
    expect(axisKey({ kind: 'unit', unit })).not.toBe(
      axisKey({ kind: 'unit', unit: { ...unit, unit_path: ['1. 문학', '(1) 시'] } }),
    );
    expect(axisKey({ kind: 'unit-none' })).not.toBe(axisKey({ kind: 'grammar-none' }));
  });
});

describe('tabForAxis', () => {
  it('걸린 축의 탭을 연다', () => {
    expect(tabForAxis(ALL_REFERENCE_TEXTS)).toBe('units');
    expect(tabForAxis({ kind: 'unit-none' })).toBe('units');
    expect(tabForAxis({ kind: 'work', title: '봄봄' })).toBe('works');
    expect(tabForAxis({ kind: 'grammar', path: ['담화'] })).toBe('grammar');
    expect(tabForAxis({ kind: 'grammar-none' })).toBe('grammar');
  });
});

describe('describeAxis', () => {
  it('목록 위 요약 줄에 쓸 이름', () => {
    expect(describeAxis(ALL_REFERENCE_TEXTS)).toBe('');
    expect(describeAxis({ kind: 'unit', unit })).toBe('중2 천재(노미숙) 1학기 1. 문학');
    expect(describeAxis({ kind: 'work', title: '봄봄' })).toBe('작품 · 봄봄');
    expect(describeAxis({ kind: 'grammar', path: ['단어', '품사'] })).toBe('문법 · 단어 > 품사');
  });
});
