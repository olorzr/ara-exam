import { describe, it, expect } from 'vitest';
import {
  passageLabel, sheetKind, sheetLabel, sheetSubtitle, textLabel, textSubtitle,
} from './labels';

const sheet = (over: Partial<Parameters<typeof sheetLabel>[0]> = {}) => ({
  title: '봄봄 정리', year: '2026', grade: '중2', publisher: '천재(정호웅)',
  unit: '1. 문학의 갈래', subunit: '(1) 소설', school_name: '', print_bundle_id: null, ...over,
});

describe('sheetKind', () => {
  it('묶음 id 가 있으면 학교 프린트다 — 한 표에 살지만 화면에서는 다른 메뉴다', () => {
    expect(sheetKind({ print_bundle_id: null })).toBe('sheet');
    expect(sheetKind({ print_bundle_id: 'b1' })).toBe('print');
  });
});

describe('sheetLabel', () => {
  it('종류를 앞에 붙인다 — 정답표에 찍히는 이름이라 어디를 펴야 할지 알아야 한다', () => {
    expect(sheetLabel(sheet())).toBe('개념지 · 봄봄 정리');
    expect(sheetLabel(sheet({ print_bundle_id: 'b1' }))).toBe('학교 프린트 · 봄봄 정리');
  });

  it('제목이 비면 단원으로, 그것도 없으면 그렇다고 적는다', () => {
    expect(sheetLabel(sheet({ title: '  ' }))).toBe('개념지 · 1. 문학의 갈래');
    expect(sheetLabel(sheet({ title: '', unit: '' }))).toBe('개념지 · 제목 없는 개념지');
  });
});

describe('sheetSubtitle', () => {
  it('빈 칸은 빼고 이어 붙인다', () => {
    expect(sheetSubtitle(sheet())).toBe('2026 · 중2 · 천재(정호웅) · 1. 문학의 갈래 · (1) 소설');
  });

  it('외부지문은 출판사 자리에 학교를 싣는다', () => {
    expect(sheetSubtitle(sheet({ publisher: '', school_name: '상현중', subunit: '' })))
      .toBe('2026 · 중2 · 상현중 · 1. 문학의 갈래');
  });
});

describe('passageLabel · textLabel', () => {
  it('지문은 제목이 없으면 머리글로, 그것도 없으면 그렇다고 적는다', () => {
    expect(passageLabel({ title: '봄봄', label: '[1~3]' })).toBe('기출 지문 · 봄봄');
    expect(passageLabel({ title: '', label: '[1~3]' })).toBe('기출 지문 · [1~3]');
    expect(passageLabel({ title: '', label: '' })).toBe('기출 지문 · 제목 없는 지문');
  });

  it('전문은 지은이와 길이를 부제로 보여 준다', () => {
    expect(textLabel({ title: '봄봄' })).toBe('전문 · 봄봄');
    expect(textSubtitle({ author: '김유정', char_count: 12345 })).toBe('김유정 · 12,345자');
    expect(textSubtitle({ author: '', char_count: 100 })).toBe('100자');
  });
});
