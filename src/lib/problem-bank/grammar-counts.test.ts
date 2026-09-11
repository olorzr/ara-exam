import { describe, expect, it } from 'vitest';
import { tallyGrammarCounts } from './grammar-counts';

describe('tallyGrammarCounts', () => {
  it('잎을 세면 조상까지 함께 올라간다', () => {
    const counts = tallyGrammarCounts([['단어 > 품사 > 명사']]);

    expect(counts.get('단어')).toBe(1);
    expect(counts.get('단어 > 품사')).toBe(1);
    expect(counts.get('단어 > 품사 > 명사')).toBe(1);
  });

  /**
   * 이 테스트가 고정하는 것: 조상 건수는 잎 건수의 **합이 아니다**.
   * 더해 버리면 한 문항이 두 번 세어져 트리의 (n) 이 목록 길이와 어긋난다.
   */
  it('한 문항이 같은 조상 아래 개념 둘을 들고 있어도 조상은 1 이다', () => {
    const counts = tallyGrammarCounts([[
      '문장 > 문법 요소 > 피동 표현',
      '문장 > 문법 요소 > 사동 표현',
    ]]);

    expect(counts.get('문장')).toBe(1);
    expect(counts.get('문장 > 문법 요소')).toBe(1);
    expect(counts.get('문장 > 문법 요소 > 피동 표현')).toBe(1);
    expect(counts.get('문장 > 문법 요소 > 사동 표현')).toBe(1);
  });

  it('서로 다른 문항이면 조상에서 합쳐진다', () => {
    const counts = tallyGrammarCounts([
      ['문장 > 문법 요소 > 피동 표현'],
      ['문장 > 문법 요소 > 사동 표현'],
    ]);

    expect(counts.get('문장 > 문법 요소')).toBe(2);
    expect(counts.get('문장 > 문법 요소 > 피동 표현')).toBe(1);
  });

  it('서로 다른 대분류는 각각 센다', () => {
    const counts = tallyGrammarCounts([['단어 > 품사 > 명사', '음운 > 음운 체계 > 음운']]);

    expect(counts.get('단어')).toBe(1);
    expect(counts.get('음운')).toBe(1);
  });

  it('마스터에 없는 옛 경로도 세고 조상까지 편다', () => {
    const counts = tallyGrammarCounts([['옛분류 > 옛개념']]);

    expect(counts.get('옛분류')).toBe(1);
    expect(counts.get('옛분류 > 옛개념')).toBe(1);
  });

  it('빈 배열·빈 문자열은 무시한다', () => {
    expect(tallyGrammarCounts([]).size).toBe(0);
    expect(tallyGrammarCounts([[]]).size).toBe(0);
    expect(tallyGrammarCounts([['']]).size).toBe(0);
  });

  it('구분자 주변 공백이 흔들려도 같은 경로로 센다', () => {
    const counts = tallyGrammarCounts([['단어>품사>명사'], ['단어 > 품사 > 명사']]);

    expect(counts.get('단어 > 품사 > 명사')).toBe(2);
  });
});
