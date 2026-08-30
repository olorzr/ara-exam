import { describe, it, expect } from 'vitest';
import { normalizeCategoryName } from './category-name';

const CANONICAL = '천재(정호웅)';

describe('normalizeCategoryName', () => {
  it('여는 괄호 앞 공백을 제거한다', () => {
    expect(normalizeCategoryName('천재 (정호웅)')).toBe(CANONICAL);
    expect(normalizeCategoryName('비상 (박현숙)')).toBe('비상(박현숙)');
  });

  it('NFD(자모 분리) 입력을 NFC 로 모아 같은 값으로 만든다', () => {
    const nfd = CANONICAL.normalize('NFD');
    expect(nfd).not.toBe(CANONICAL); // 전제 확인: 실제로 바이트가 다르다
    expect(normalizeCategoryName(nfd)).toBe(CANONICAL);
  });

  it('폭 없는 문자(ZWSP·BOM)를 제거한다', () => {
    expect(normalizeCategoryName('천재​(정호웅)')).toBe(CANONICAL);
    expect(normalizeCategoryName('﻿천재(정호웅)')).toBe(CANONICAL);
  });

  it('NBSP·전각 공백을 일반 공백으로 바꾼 뒤 정리한다', () => {
    expect(normalizeCategoryName('천재 (정호웅)')).toBe(CANONICAL);
    expect(normalizeCategoryName('천재　(정호웅)')).toBe(CANONICAL);
    expect(normalizeCategoryName('천재 교과서')).toBe('천재 교과서');
  });

  it('전각 괄호를 ASCII 괄호로 바꾼다', () => {
    expect(normalizeCategoryName('천재（정호웅）')).toBe(CANONICAL);
  });

  it('양끝 공백과 연속 공백을 정리한다', () => {
    expect(normalizeCategoryName('  천재(정호웅)  ')).toBe(CANONICAL);
    expect(normalizeCategoryName('천재   교과서')).toBe('천재 교과서');
  });

  it('낱말 사이의 정상적인 공백은 보존한다', () => {
    expect(normalizeCategoryName('천재 교과서')).toBe('천재 교과서');
    expect(normalizeCategoryName('1. 문학의 즐거움')).toBe('1. 문학의 즐거움');
  });

  it('분리된 자모 사이에 낀 폭 없는 문자도 합쳐 준다 (멱등 회귀)', () => {
    // 'ᄀ' + ZWSP + 'ᅡ' — 폭 없는 문자를 NFC 보다 먼저 떼지 않으면 자모가 분리된 채
    // 남아 결과가 NFC 가 아니게 되고, 다시 정규화하면 값이 또 바뀐다.
    const jamoWithZwsp = '\u1100\u200B\u1161';
    const once = normalizeCategoryName(jamoWithZwsp);
    expect(once).toBe('가');
    expect(normalizeCategoryName(once)).toBe(once);
  });

  it('멱등이다 — 이미 정규화된 값을 다시 넣어도 그대로다', () => {
    const inputs = [
      '천재 (정호웅)', '천재​ (정호웅)', '천재（정호웅）',
      CANONICAL, '천재 교과서', '', '소나기 (황순원) 외 2편',
    ];
    for (const input of inputs) {
      const once = normalizeCategoryName(input);
      expect(normalizeCategoryName(once)).toBe(once);
    }
  });

  it('괄호 안쪽 가장자리 공백도 제거한다', () => {
    expect(normalizeCategoryName('천재( 정호웅 )')).toBe(CANONICAL);
    expect(normalizeCategoryName('천재 ( 정호웅 )')).toBe(CANONICAL);
    expect(normalizeCategoryName('( 전체 )')).toBe('(전체)');
  });

  it('괄호 안쪽 낱말 사이 공백은 보존한다', () => {
    expect(normalizeCategoryName('소나기 ( 황순원 외 2인 )')).toBe('소나기(황순원 외 2인)');
  });

  it('빈 문자열과 공백만 있는 값은 빈 문자열이 된다', () => {
    expect(normalizeCategoryName('')).toBe('');
    expect(normalizeCategoryName('   ')).toBe('');
    expect(normalizeCategoryName(' ​')).toBe('');
  });

  it('여러 변형이 하나의 표준 표기로 수렴한다', () => {
    const variants = [
      '천재(정호웅)',
      '천재 (정호웅)',
      '천재 (정호웅)',
      '천재（정호웅）',
      ' 천재  (정호웅) ',
      '천재( 정호웅 )',
      '천재 ( 정호웅 )',
      '천재(정호웅)'.normalize('NFD'),
      '천재 (정호웅)'.normalize('NFD').replace('재', '재\u200B'),
    ];
    const normalized = new Set(variants.map(normalizeCategoryName));
    expect(normalized.size).toBe(1);
    expect([...normalized][0]).toBe(CANONICAL);
  });
});
