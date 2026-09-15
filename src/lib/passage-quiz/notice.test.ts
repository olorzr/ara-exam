import { describe, it, expect } from 'vitest';
import { passageQuizEmptyNotice } from './notice';
import type { PassageQuizResult } from './parse';

const result = (over: Partial<PassageQuizResult['dropped']> = {}): PassageQuizResult => ({
  ox: [], short: [],
  dropped: { evidenceNotInText: 0, answerNotInText: 0, duplicate: 0, malformed: 0, ...over },
});

describe('passageQuizEmptyNotice', () => {
  it('아무것도 못 만든 경우와 만들어 놓고 다 걸러진 경우를 가른다', () => {
    // 뭉뚱그리면 '지문을 바꿔야 하나'와 '다시 눌러 보면 되나'를 구분할 수 없다
    expect(passageQuizEmptyNotice(result()).text).toContain('문제로 낼 내용을 찾지 못했어요');
    expect(passageQuizEmptyNotice(result({ evidenceNotInText: 3 })).text)
      .toContain('모두 지문·참고자료와 맞지 않아 뺐어요');
  });

  it('둘 다 경고다 — 하나도 못 만든 것은 정상이 아니다', () => {
    expect(passageQuizEmptyNotice(result()).level).toBe('warning');
    expect(passageQuizEmptyNotice(result({ malformed: 1 })).level).toBe('warning');
  });
});
