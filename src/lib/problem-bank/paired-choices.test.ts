import { describe, expect, it } from 'vitest';
import { matrixChoices, pairedChoices } from './paired-choices';

describe('pairedChoices', () => {
  it('keeps the two source columns aligned without repeating their labels in every row', () => {
    const stem = '<p>질문</p><p>㉮　　㉯</p>';
    const choices = Array.from({ length: 5 }, (_, i) =>
      `<u>㉮</u> ㄱ, ${i}<br><u>㉯</u> ㄴ`);
    expect(pairedChoices(stem, choices)).toEqual({
      stemHtml: '<p>질문</p>',
      rows: choices.map((_, i) => [`ㄱ, ${i}`, 'ㄴ']),
    });
  });

  it('does not reinterpret ordinary multiline choices', () => {
    expect(pairedChoices('<p>질문</p>', ['가<br>나'])).toBeNull();
  });
});

describe('matrixChoices', () => {
  it('keeps dictionary headword and example columns aligned', () => {
    const stem = '<p>질문</p><figure data-figure="1"></figure><p>ⓐ　ⓑ　ⓒ</p>';
    const choices = Array.from({ length: 5 }, (_, i) => `<strong>밭게</strong> 부<br>㉠<br>㉡${i}`);
    expect(matrixChoices(stem, choices)?.headers).toEqual(['ⓐ', 'ⓑ', 'ⓒ']);
    expect(matrixChoices(stem, choices)?.rows[0]).toEqual(['<strong>밭게</strong> 부', '㉠', '㉡0']);
  });

  it('keeps the two source columns aligned outside the 보기 box', () => {
    const stem = '<blockquote data-box="보기"><p>자료</p></blockquote><p>A B</p>';
    const choices = Array.from({ length: 5 }, (_, i) => `진양성${i}<br>진음성${i}`);
    expect(matrixChoices(stem, choices)).toEqual({
      stemHtml: '<blockquote data-box="보기"><p>자료</p></blockquote>',
      headers: ['A', 'B'],
      rows: choices.map((_, i) => [`진양성${i}`, `진음성${i}`]),
    });
  });

  it('keeps the three source columns aligned', () => {
    const stem = '<blockquote data-box="보기"><p>자료</p></blockquote><p>㉠　　㉡　　㉢</p>';
    const choices = Array.from({ length: 5 }, (_, i) => `가${i}<br>나${i}<br>다${i}`);
    expect(matrixChoices(stem, choices)).toEqual({
      stemHtml: '<blockquote data-box="보기"><p>자료</p></blockquote>',
      headers: ['㉠', '㉡', '㉢'],
      rows: choices.map((_, i) => [`가${i}`, `나${i}`, `다${i}`]),
    });
  });

  it('removes a four-column header inside the source box', () => {
    const stem = '<blockquote data-box="보기"><p>자료</p><p>A B C D</p></blockquote>';
    const choices = Array(5).fill('불황<br>거시<br>사용<br>미시');
    expect(matrixChoices(stem, choices)?.stemHtml).toBe('<blockquote data-box="보기"><p>자료</p></blockquote>');
    expect(matrixChoices(stem, choices)?.headers).toEqual(['A', 'B', 'C', 'D']);
  });

  it('leaves unrelated multiline choices alone', () => {
    expect(matrixChoices('<p>질문</p>', Array(5).fill('가<br>나<br>다'))).toBeNull();
  });
});
