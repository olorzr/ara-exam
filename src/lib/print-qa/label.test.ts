import { describe, expect, it } from 'vitest';
import {
  LABEL_MARKS, LABEL_ONLY, matchesLabel, stripLabelLine, stripSameLineLabel,
} from './label';

describe('LABEL_ONLY ↔ LABEL_MARKS', () => {
  it('⚠️ 벗기는 기호는 **알아보는 기호**와 같아야 한다 (코덱스 13R·14R 블로킹)', () => {
    // 한쪽만 알아보면 맞추기는 하면서 지켜 주지 않아 진짜 문항이 중복으로 사라진다
    for (const mark of ['.', ')', ':', '：', ';', '；', ']', '·', ',', '，', '、']) {
      expect(LABEL_ONLY.test(`ㄱ${mark}`)).toBe(true);
      expect(`ㄱ${mark}`.replace(LABEL_MARKS, '')).toBe('ㄱ');
    }
  });

  it('⚠️ 기호가 겹치거나 공백이 끼어도 번호다 (코덱스 15R·16R 블로킹)', () => {
    expect(LABEL_ONLY.test('(1).')).toBe(true);
    expect(LABEL_ONLY.test('( 1 )')).toBe(true);
    expect(matchesLabel('( 2 )', '2')).toBe(true);
    expect(LABEL_ONLY.test('( 2 )')).toBe(true);
  });

  it('여는 기호도 전각까지 알아본다', () => {
    expect(LABEL_ONLY.test('（1）')).toBe(true);
    expect(LABEL_ONLY.test('(1)')).toBe(true);
    expect(LABEL_ONLY.test('①')).toBe(true);
    expect(LABEL_ONLY.test('문 3)')).toBe(true);
  });

  it('멀쩡한 글줄은 번호가 아니다', () => {
    expect(LABEL_ONLY.test('예시 1개')).toBe(false);
    expect(LABEL_ONLY.test('1930년대에')).toBe(false);
  });
});

describe('matchesLabel', () => {
  it('⚠️ 숫자 묶음을 통째로 견준다 — 1 이 11 에 걸리면 진짜 11번이 사라진다', () => {
    expect(matchesLabel('1.', '1')).toBe(true);
    expect(matchesLabel('11.', '1')).toBe(false);
    expect(matchesLabel('3-1)', '3-1')).toBe(true);
  });

  it('⚠️ 전각 콜론 번호도 제 자리를 찾는다 (코덱스 13R)', () => {
    expect(matchesLabel('ㄱ：', 'ㄱ')).toBe(true);
    expect(matchesLabel('ㄴ；', 'ㄴ')).toBe(true);
    expect(matchesLabel('ㄴ；', 'ㄱ')).toBe(false);
  });
});

describe('stripLabelLine', () => {
  it('⚠️ 맨 숫자 한 줄은 문제에 주어진 값이다 — 떼지 않는다 (코덱스 14R 블로킹)', () => {
    expect(stripLabelLine('다음 수를 보고 답하시오.\n5', '')).toBe('다음 수를 보고 답하시오.\n5');
    expect(stripLabelLine('다음 수를 보고 답하시오.\n5', '1')).toBe('다음 수를 보고 답하시오.\n5');
  });

  it('⚠️ **이 문항의 번호**일 때만 뗀다 — 주어진 값이 사라진다 (코덱스 33R 블로킹)', () => {
    expect(stripLabelLine('다음 수를 보고 물음에 답하시오.\n(5)', '1'))
      .toBe('다음 수를 보고 물음에 답하시오.\n(5)');
    expect(stripLabelLine('앞 설명이다.\n12)', '12')).toBe('앞 설명이다.\n');
    expect(stripLabelLine('다음 수를 보고 답하시오.\n5', '5')).toBe('다음 수를 보고 답하시오.\n');
  });

  it('번호를 모르면 떼지 않는다 — 원본 번호가 남는 흠은 눈에 보인다', () => {
    expect(stripLabelLine('앞 설명이다.\n12)', '')).toBe('앞 설명이다.\n12)');
  });
});

describe('stripSameLineLabel', () => {
  it('⚠️ 공백이 낀 번호도 뗀다 — 번호가 두 번 찍힌다 (코덱스 30R 블로킹)', () => {
    expect(stripSameLineLabel('지문이다. ( 1 )', '( 1 )')).toBe('지문이다. ');
    expect(stripSameLineLabel('지문이다. 문 1)', '문 1)')).toBe('지문이다. ');
    expect(stripSameLineLabel('지문이다. 3 - 1)', '3-1')).toBe('지문이다. ');
  });

  it('문장 안의 숫자는 그대로 둔다', () => {
    expect(stripSameLineLabel('주어진 수는 1.', '1')).toBeNull();
    expect(stripSameLineLabel('지문 끝의 값은 1', '1')).toBeNull();
  });
});
