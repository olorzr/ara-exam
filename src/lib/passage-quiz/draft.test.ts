import { describe, it, expect } from 'vitest';
import { PASSAGE_QUIZ_MAX_PER_TYPE, PASSAGE_QUIZ_TEXT_LIMIT } from './constants';
import { EMPTY_DRAFT, draftBlocker, draftCounts, parseCountInput } from './draft';

const draft = (over: Partial<typeof EMPTY_DRAFT> = {}) => ({ ...EMPTY_DRAFT, text: '지문', ...over });

describe('parseCountInput', () => {
  it('비우면 자동(null)이다 — 0 과 다르다', () => {
    expect(parseCountInput('')).toBeNull();
    expect(parseCountInput('   ')).toBeNull();
    expect(parseCountInput('0')).toBe(0);
  });

  it('숫자가 아니면 자동으로 본다', () => {
    expect(parseCountInput('열')).toBeNull();
  });

  it('상한을 넘겨 적어도 상한까지만 받는다', () => {
    expect(parseCountInput(String(PASSAGE_QUIZ_MAX_PER_TYPE + 10))).toBe(PASSAGE_QUIZ_MAX_PER_TYPE);
    expect(parseCountInput('-3')).toBe(0);
    expect(parseCountInput('3.7')).toBe(3);
  });
});

describe('draftCounts', () => {
  it('두 칸을 각각 읽는다', () => {
    expect(draftCounts(draft({ oxCount: '3', shortCount: '' })))
      .toEqual({ ox: 3, short: null });
  });
});

describe('draftBlocker', () => {
  it('지문이 없으면 막는다', () => {
    expect(draftBlocker(draft({ text: '   ' }))).toContain('지문을 붙여 넣어 주세요');
  });

  it('너무 길면 보내기 전에 알린다 — 사람이 줄이면 해결된다', () => {
    expect(draftBlocker(draft({ text: 'ㄱ'.repeat(PASSAGE_QUIZ_TEXT_LIMIT + 1) })))
      .toContain('너무 길어요');
  });

  it('두 유형을 다 0 으로 두면 막는다 — 낼 문항이 없다', () => {
    expect(draftBlocker(draft({ oxCount: '0', shortCount: '0' })))
      .toContain('하나는 만들어야 해요');
  });

  it('지문이 있고 개수가 자동이면 만들 수 있다', () => {
    expect(draftBlocker(draft())).toBeNull();
    expect(draftBlocker(draft({ oxCount: '0', shortCount: '5' }))).toBeNull();
  });
});
