import { describe, expect, it } from 'vitest';
import type { PrintQaSplitResult } from './parse-split';
import { answersWarnings, splitWarnings } from './notice';

const result = (over: Partial<PrintQaSplitResult> = {}): PrintQaSplitResult => ({
  items: [],
  work: { title: '', author: '' },
  warnings: [],
  dropped: {
    malformed: 0,
    duplicate: 0,
    answerNotInText: 0,
    answerOutOfRegion: 0,
    droppedLeads: 0,
    truncatedLeads: 0,
    answerInQuestion: 0,
  },
  ...over,
});

describe('splitWarnings', () => {
  it('⚠️ 우리 경고가 모델 경고보다 앞이다 — 뒤에 두면 상한에 잘려 사라진다 (코덱스 4R)', () => {
    const many = Array.from({ length: 20 }, (_, i) => `모델 경고 ${i}`);
    const out = splitWarnings(result({
      warnings: many,
      dropped: {
        malformed: 0,
        duplicate: 0,
        answerNotInText: 0,
        answerOutOfRegion: 1,
        droppedLeads: 1,
        truncatedLeads: 0,
        answerInQuestion: 0,
      },
    }));
    expect(out.slice(0, 2).join('\n')).toContain('다른 곳에서 찾았어요');
    expect(out.slice(0, 2).join('\n')).toContain('가져오지 못했어요');
  });

  it('알릴 것이 없으면 빈 배열', () => {
    expect(splitWarnings(result())).toEqual([]);
  });
});

describe('splitWarnings — 코덱스 5R', () => {
  it('⚠️ 앞 지문을 잘랐으면 알린다 — 조용히 자르면 원래 없던 줄 안다', () => {
    const out = splitWarnings(result({
      dropped: {
        malformed: 0,
        duplicate: 0,
        answerNotInText: 0,
        answerOutOfRegion: 0,
        droppedLeads: 0,
        truncatedLeads: 1,
        answerInQuestion: 0,
      },
    }));
    expect(out.join('\n')).toContain('앞부분을 잘랐어요');
  });

  it('못 실은 앞글은 **원본 그림**을 보라고 한다 — 교사용에도 그 지문은 없다', () => {
    const out = splitWarnings(result({
      dropped: {
        malformed: 0,
        duplicate: 0,
        answerNotInText: 0,
        answerOutOfRegion: 0,
        droppedLeads: 1,
        truncatedLeads: 0,
        answerInQuestion: 0,
      },
    }));
    expect(out.join('\n')).toContain('원본 쪽 그림');
  });
});

describe('answersWarnings', () => {
  it('⚠️ 답이 생기고 나서야 알 수 있는 노출을 알린다 (코덱스 23R)', () => {
    expect(answersWarnings(0)).toEqual([]);
    expect(answersWarnings(2)[0]).toContain('2개');
  });
});
