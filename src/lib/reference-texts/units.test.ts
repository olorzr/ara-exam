import { describe, it, expect } from 'vitest';
import type { ReferenceUnit } from '@/types/reference-text';
import {
  isReferenceUnit, normalizeReferenceUnits, stringsEqual, toggleReferenceUnit, unitFromCategory,
  unitKey, unitLabel, unitsEqual,
} from './units';

const unit = (over: Partial<ReferenceUnit> = {}): ReferenceUnit => ({
  grade: '중2', textbook: '천재(노미숙)', semester: '1학기', unit_path: ['1. 문학', '(1) 시'], ...over,
});

describe('unitFromCategory', () => {
  it('출판사는 교과서로, 대단원·소단원은 경로로 옮긴다', () => {
    expect(unitFromCategory({
      grade: '중2', publisher: '천재(노미숙)', semester: '1학기', chapter: '1. 문학', sub_chapter: '(1) 시',
    })).toEqual(unit());
  });

  it('소단원이 없으면 대단원 하나짜리 경로다 — 대단원 검색이 그 아래를 다 잡는다', () => {
    expect(unitFromCategory({
      grade: '고1', publisher: '비상', semester: '', chapter: '3. 소설', sub_chapter: '',
    }).unit_path).toEqual(['3. 소설']);
  });
});

describe('unitLabel', () => {
  it('빈 칸은 빼고 한 줄로 잇는다', () => {
    expect(unitLabel(unit())).toBe('중2 천재(노미숙) 1학기 1. 문학 > (1) 시');
    expect(unitLabel(unit({ semester: '', unit_path: ['3. 소설'] }))).toBe('중2 천재(노미숙) 3. 소설');
  });
});

describe('unitKey', () => {
  it('⚠️ 이름에 구분자 같은 글자가 들어도 다른 단원과 겹치지 않는다', () => {
    const a = unit({ textbook: '천재|노미숙', unit_path: ['1'] });
    const b = unit({ textbook: '천재', unit_path: ['노미숙|1'] });
    expect(unitKey(a)).not.toBe(unitKey(b));
  });
});

describe('normalizeReferenceUnits', () => {
  it('이름의 공백·전각 괄호를 카테고리 표기로 맞춘다', () => {
    expect(normalizeReferenceUnits([unit({ textbook: ' 천재 （노미숙） ', grade: ' 중2 ' })]))
      .toEqual([unit()]);
  });

  it('빈 마디를 버리고 2단까지만 남긴다 — DB 검사가 3단을 거절한다', () => {
    expect(normalizeReferenceUnits([unit({ unit_path: ['', '1. 문학', '(1) 시', '①'] })])[0].unit_path)
      .toEqual(['1. 문학', '(1) 시']);
  });

  it('교과서나 대단원이 없는 단원은 버린다', () => {
    expect(normalizeReferenceUnits([unit({ textbook: '  ' }), unit({ unit_path: [' '] })])).toEqual([]);
  });

  it('같은 단원은 한 번만 — 먼저 붙인 것이 남는다', () => {
    const other = unit({ textbook: '비상(김진수)' });
    expect(normalizeReferenceUnits([unit(), other, unit({ textbook: '천재 (노미숙)' })]))
      .toEqual([unit(), other]);
  });

  it('여덟 개까지만 — 붙인 순서를 지키며 자른다', () => {
    const many = Array.from({ length: 10 }, (_, i) => unit({ unit_path: [`${i + 1}. 단원`] }));
    const out = normalizeReferenceUnits(many);
    expect(out).toHaveLength(8);
    expect(out[0].unit_path).toEqual(['1. 단원']);
    expect(out[7].unit_path).toEqual(['8. 단원']);
  });
});

describe('isReferenceUnit', () => {
  it('DB 에서 온 모양만 받는다', () => {
    expect(isReferenceUnit(unit())).toBe(true);
    expect(isReferenceUnit(null)).toBe(false);
    expect(isReferenceUnit([unit()])).toBe(false);
    expect(isReferenceUnit({ ...unit(), unit_path: '1. 문학' })).toBe(false);
    expect(isReferenceUnit({ ...unit(), unit_path: [1] })).toBe(false);
    expect(isReferenceUnit({ grade: '중2', textbook: '천재', unit_path: [] })).toBe(false);
  });
});

describe('unitsEqual · stringsEqual', () => {
  it('내용과 순서가 같아야 같다', () => {
    const other = unit({ textbook: '비상' });
    expect(unitsEqual([unit(), other], [unit(), other])).toBe(true);
    expect(unitsEqual([unit(), other], [other, unit()])).toBe(false);
    expect(unitsEqual([unit()], [])).toBe(false);
    expect(stringsEqual(['가', '나'], ['가', '나'])).toBe(true);
    expect(stringsEqual(['가', '나'], ['나', '가'])).toBe(false);
  });
});

describe('toggleReferenceUnit', () => {
  it('없으면 끝에 붙이고, 있으면 뗀다', () => {
    const other = unit({ textbook: '비상' });
    expect(toggleReferenceUnit([unit()], other)).toEqual([unit(), other]);
    expect(toggleReferenceUnit([unit(), other], unit())).toEqual([other]);
  });

  it('여덟 개가 차면 붙이지 않고 null — 떼기는 그대로 된다', () => {
    const full = Array.from({ length: 8 }, (_, i) => unit({ unit_path: [`${i + 1}. 단원`] }));
    expect(toggleReferenceUnit(full, unit({ unit_path: ['9. 단원'] }))).toBeNull();
    expect(toggleReferenceUnit(full, full[0])).toHaveLength(7);
  });
});
