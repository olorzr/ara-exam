import { describe, it, expect } from 'vitest';
import { nextWordCount, registeredWordCount, sampleNames, wordsChip } from './summary';

describe('wordsChip', () => {
  it('한 번도 안 돌렸으면 칩이 없다', () => {
    expect(wordsChip({})).toBeNull();
    expect(wordsChip(null)).toBeNull();
  });

  it('등록했으면 개수를 보여 준다', () => {
    const chip = wordsChip({ status: 'done', registered: 12, wordCount: 12 });
    expect(chip?.label).toBe('단어 12개');
    expect(chip?.tone).toBe('ok');
  });

  it("찾은 게 없으면 '단어 없음' — 실패와 구분한다(다음에 할 일이 다르다)", () => {
    expect(wordsChip({ status: 'empty' })?.label).toBe('단어 없음');
    expect(wordsChip({ status: 'empty' })?.tone).toBe('muted');
    expect(wordsChip({ status: 'failed' })?.label).toBe('단어 등록 실패');
    expect(wordsChip({ status: 'failed' })?.tone).toBe('error');
  });

  it('아무것도 안 들어갔으면 개수를 자랑하지 않는다', () => {
    expect(wordsChip({ status: 'done', registered: 0, wordCount: 0 })?.label).toBe('단어 없음');
  });

  it('다시 등록해 전부 중복이어도 **단어가 있다고** 말한다 — 0개라고 하면 링크까지 사라진다', () => {
    const chip = wordsChip({ status: 'done', registered: 0, skipped: 12, wordCount: 12 });
    expect(chip?.label).toBe('단어 12개');
    expect(chip?.tone).toBe('ok');
  });

  it('다시 등록하다 실패해도 이미 올려 둔 단어를 잊지 않는다 — 링크와 삭제 안내가 걸려 있다', () => {
    const chip = wordsChip({ status: 'failed', wordCount: 12, warnings: ['한도에 걸렸어요'] });
    expect(chip?.label).toBe('단어 등록 실패');
    expect(chip?.title).toContain('이미 등록해 둔 단어 12개는 그대로 있어요');
  });

  it("이번엔 못 찾았어도 올려 둔 단어가 있으면 개수를 말한다", () => {
    expect(wordsChip({ status: 'empty', wordCount: 9 })?.label).toBe('단어 9개');
  });

  it('건너뛴 것·뜻 없는 것을 툴팁에 담는다 — 칩은 짧아야 하고 자세한 건 올려 봐야 한다', () => {
    const chip = wordsChip({ status: 'done', registered: 5, skipped: 3, noMeaning: 2, wordCount: 8 });
    expect(chip?.label).toBe('단어 8개');
    expect(chip?.title).toContain('이미 있던 단어 3개');
    expect(chip?.title).toContain('뜻이 안 적혀 있어 뺀 단어 2개');
  });

  it('실패 툴팁은 경고를 그대로 보여 준다', () => {
    const chip = wordsChip({ status: 'failed', warnings: ['한도에 걸렸어요'] });
    expect(chip?.title).toContain('한도에 걸렸어요');
  });

  it('프린트에 없던 뜻을 뺀 사실도 툴팁에 담는다', () => {
    const chip = wordsChip({ status: 'done', registered: 4, unverified: 2 });
    expect(chip?.title).toContain('프린트에 없는 뜻이 붙어 있어 뺀 단어 2개');
  });
});

describe('registeredWordCount', () => {
  it('누적값을 그대로 쓴다 — 마지막 시도의 숫자가 아니다', () => {
    expect(registeredWordCount({ status: 'done', registered: 0, skipped: 12, wordCount: 12 })).toBe(12);
    // 다시 등록하다 실패해도 DB 의 단어는 그대로다
    expect(registeredWordCount({ status: 'failed', wordCount: 12 })).toBe(12);
  });

  it('등록한 적이 없으면 0 — 삭제 확인창이 없는 단어 얘기를 하면 안 된다', () => {
    expect(registeredWordCount({})).toBe(0);
    expect(registeredWordCount(null)).toBe(0);
    expect(registeredWordCount({ status: 'failed' })).toBe(0);
  });
});

describe('nextWordCount', () => {
  it('처음 등록하면 넣은 수 그대로', () => {
    expect(nextWordCount(0, 12, 0)).toBe(12);
  });

  it('처음인데 그 단어들이 이미 있었으면 건너뛴 수를 센다 — 이 프린트의 단어인 건 같다', () => {
    expect(nextWordCount(0, 0, 12)).toBe(12);
  });

  it('전부 중복인 재등록은 그대로', () => {
    expect(nextWordCount(12, 0, 12)).toBe(12);
  });

  it('**부분 겹침**을 놓치지 않는다 — 10개에 새로 5개면 15개다', () => {
    expect(nextWordCount(10, 5, 5)).toBe(15);
  });

  it('이번에 아무것도 못 찾아도 줄지 않는다 — DB 의 단어는 그대로다', () => {
    expect(nextWordCount(10, 0, 0)).toBe(10);
    expect(nextWordCount(10, 0, 3)).toBe(10);
  });
});

describe('sampleNames', () => {
  it('열 개까지는 그대로 적는다', () => {
    expect(sampleNames(['상기', '통념'])).toBe('상기, 통념');
    expect(sampleNames([])).toBe('');
  });

  it('넘으면 나머지를 세어 준다 — 경고 한 줄이 끝없이 길어지지 않게', () => {
    const many = Array.from({ length: 13 }, (_, i) => `단어${i + 1}`);
    expect(sampleNames(many)).toContain('외 3개');
    expect(sampleNames(many).startsWith('단어1, 단어2')).toBe(true);
  });
});
