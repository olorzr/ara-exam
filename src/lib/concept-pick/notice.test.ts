import { describe, it, expect } from 'vitest';
import { conceptPickEmptyNotice } from './notice';
import type { ConceptPickResult } from './parse';

const result = (over: Partial<ConceptPickResult> = {}): ConceptPickResult => ({
  picks: [],
  dropped: { notInText: 0, duplicate: 0, malformed: 0 },
  ...over,
});

describe('conceptPickEmptyNotice', () => {
  it('이미 마킹이 있는데 빈 배열이면 안내다 — AI 가 일부러 안 고른 것이라 오류가 아니다', () => {
    const notice = conceptPickEmptyNotice(result(), true);
    expect(notice.level).toBe('info');
    expect(notice.text).toContain('더 추천할 용어가 없어요');
  });

  it('마킹이 하나도 없는데 빈 배열이면 본문을 보라고 경고한다', () => {
    const notice = conceptPickEmptyNotice(result(), false);
    expect(notice.level).toBe('warning');
    expect(notice.text).toContain('외울 만한 용어');
  });

  it('골랐는데 전부 걸러졌으면 경고다 — AI 가 안 고른 것과 가른다', () => {
    const notice = conceptPickEmptyNotice(
      result({ dropped: { notInText: 0, duplicate: 0, malformed: 1 } }), true,
    );
    expect(notice.level).toBe('warning');
    expect(notice.text).toContain('마킹할 용어를 찾지 못했어요');
  });

  it('골라 놓고 하나도 못 붙였으면 "못 찾았다" 고 하지 않는다 — 자리를 못 찾은 것뿐이다', () => {
    const notice = conceptPickEmptyNotice(
      result({ picks: [{ text: '갈래', reason: '', context: '' }] }), false,
    );
    expect(notice.level).toBe('warning');
    expect(notice.text).toContain('붙이지 못했어요');
    expect(notice.text).not.toContain('찾지 못했어요');
  });
});
