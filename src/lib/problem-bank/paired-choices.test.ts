import { describe, expect, it } from 'vitest';
import { pairedChoices } from './paired-choices';

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
