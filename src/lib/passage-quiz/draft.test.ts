import { describe, it, expect } from 'vitest';
import {
  PASSAGE_QUIZ_BUNDLE_LIMIT, PASSAGE_QUIZ_MAX_PER_TYPE, PASSAGE_QUIZ_TEXT_LIMIT,
} from './constants';
import {
  EMPTY_DRAFT, applyQuizTypeMode, draftBlocker, draftCounts, parseCountInput, quizTypeMode, referenceBlocker,
} from './draft';

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

describe('referenceBlocker', () => {
  const idle = { referenceChars: 0, loading: false };

  it('찾는 중에도 막는다 — 제목을 적자마자 누르면 참고자료 없이 만들어진다', () => {
    expect(referenceBlocker(draft(), { referenceChars: 0, loading: false, searching: true }))
      .toContain('찾는 중');
  });

  it('본문을 아직 못 받은 자료가 있으면 기다린다 — 그 자료 없이 만들어 버리면 안 된다', () => {
    expect(referenceBlocker(draft(), { referenceChars: 100, loading: true }))
      .toContain('불러오는 중');
  });

  it('지문과 참고자료를 합쳐 상한을 넘으면 보내기 전에 막는다', () => {
    const blocker = referenceBlocker(
      draft({ text: 'ㄱ'.repeat(1000) }),
      { referenceChars: PASSAGE_QUIZ_BUNDLE_LIMIT, loading: false },
    );
    expect(blocker).toContain('합쳐 너무 길어요');
    expect(blocker).toContain('참고자료를 빼 주세요');
  });

  it('참고자료가 없거나 짧으면 막지 않는다', () => {
    expect(referenceBlocker(draft(), idle)).toBeNull();
    expect(referenceBlocker(draft(), { referenceChars: 5_000, loading: false })).toBeNull();
  });
});

describe('quizTypeMode', () => {
  it('기본(둘 다 자동)은 섞어서다 — 예전과 같다', () => {
    expect(quizTypeMode(EMPTY_DRAFT)).toBe('mix');
    expect(quizTypeMode(draft({ oxCount: '5', shortCount: '3' }))).toBe('mix');
  });

  it('한 유형이 0 이고 다른 유형이 0 이 아니면 그 유형만이다 — 칸에 0 을 직접 적어도 같다', () => {
    expect(quizTypeMode(draft({ shortCount: '0' }))).toBe('ox');
    expect(quizTypeMode(draft({ oxCount: '7', shortCount: ' 00 ' }))).toBe('ox');
    expect(quizTypeMode(draft({ oxCount: '0', shortCount: '4' }))).toBe('short');
  });

  it('둘 다 0 이면 섞어서로 본다 — 만들 수 없는 상태는 draftBlocker 가 알린다', () => {
    expect(quizTypeMode(draft({ oxCount: '0', shortCount: '0' }))).toBe('mix');
  });
});

describe('applyQuizTypeMode', () => {
  it('O,X 만 — 단답형을 0 으로, 적어 둔 O,X 개수는 남긴다', () => {
    expect(applyQuizTypeMode(draft({ oxCount: '6', shortCount: '3' }), 'ox')).toEqual({ oxCount: '6', shortCount: '0' });
  });

  it('⚠️ O,X 가 0 이던 채로 O,X 만을 고르면 자동으로 되돌린다 — 둘 다 0 이면 못 만든다', () => {
    const patch = applyQuizTypeMode(draft({ oxCount: '0', shortCount: '4' }), 'ox');
    expect(patch).toEqual({ oxCount: '', shortCount: '0' });
    expect(quizTypeMode(patch)).toBe('ox');
    expect(draftBlocker(draft(patch))).toBeNull();
  });

  it('단답형만 — 거꾸로다', () => {
    expect(applyQuizTypeMode(draft({ shortCount: '0' }), 'short')).toEqual({ oxCount: '0', shortCount: '' });
  });

  it('섞어서 — 0 인 칸만 자동으로 되돌리고 적어 둔 개수는 남긴다', () => {
    expect(applyQuizTypeMode(draft({ oxCount: '5', shortCount: '0' }), 'mix')).toEqual({ oxCount: '5', shortCount: '' });
  });

  it('고른 모드가 그대로 읽힌다 — 세 모드 모두 왕복한다', () => {
    for (const mode of ['mix', 'ox', 'short'] as const) {
      expect(quizTypeMode(applyQuizTypeMode(EMPTY_DRAFT, mode))).toBe(mode);
    }
  });
});
