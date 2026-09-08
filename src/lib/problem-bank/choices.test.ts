import { describe, it, expect } from 'vitest';
import { blankChoicePositions, trimTrailingChoices } from './choices';

describe('trimTrailingChoices', () => {
  it('뒤쪽 빈 칸을 잘라 낸다', () => {
    expect(trimTrailingChoices(['가', '나', '다', '', ''])).toEqual(['가', '나', '다']);
  });

  it('가운데 빈 칸은 자리를 지킨다 — 압축하면 정답 번호가 다른 선지를 가리킨다', () => {
    // ② 를 비웠는데 압축하면 ③ 이 ② 자리로 오고, 정답 '3' 은 그대로라 답이 어긋난다
    expect(trimTrailingChoices(['가', '', '다', '라', '마']))
      .toEqual(['가', '', '다', '라', '마']);
  });

  it('앞뒤 공백을 다듬는다', () => {
    expect(trimTrailingChoices([' 가 ', '나'])).toEqual(['가', '나']);
  });

  it('전부 비면 빈 배열 (주관식·서술형)', () => {
    expect(trimTrailingChoices(['', '', '', '', ''])).toEqual([]);
    expect(trimTrailingChoices([])).toEqual([]);
  });

  it('다섯 개가 다 차 있으면 그대로', () => {
    const five = ['가', '나', '다', '라', '마'];
    expect(trimTrailingChoices(five)).toEqual(five);
  });
});

describe('blankChoicePositions', () => {
  it('빈 자리의 번호를 1부터 알려 준다', () => {
    expect(blankChoicePositions(['가', '', '다', ''])).toEqual([2, 4]);
  });

  it('빈 자리가 없으면 빈 배열', () => {
    expect(blankChoicePositions(['가', '나'])).toEqual([]);
  });
});
