import { describe, expect, it } from 'vitest';
import { isReferenceBundle, referenceAttachSlot, referenceDeletePrompt } from './bundle';

const BUNDLE_KEY = '평가문제집|동아|중2-1학기|묶음|단원|1. 생각을 키우는 소통 > (1) 효과적으로 듣고 말하기';

describe('isReferenceBundle', () => {
  it('묶기 도구가 지은 열쇠만 묶음이다', () => {
    expect(isReferenceBundle({ source_key: BUNDLE_KEY })).toBe(true);
    expect(isReferenceBundle({ source_key: '평가문제집|동아|동아-1-1|개념|10' })).toBe(false);
    expect(isReferenceBundle({ source_key: '작품|동백꽃|김유정|동아' })).toBe(false);
  });

  it('화면에서 만든 행(열쇠 없음)은 묶음이 아니다', () => {
    expect(isReferenceBundle({ source_key: null })).toBe(false);
  });
});

describe('referenceDeletePrompt', () => {
  it('묶음은 낱개까지 함께 지워진다고 말한다', () => {
    const text = referenceDeletePrompt({ title: '총괄', kind: '개념', source_key: BUNDLE_KEY });
    expect(text).toContain('낱개 개념도 함께 지워지고');
  });

  it('개념과 작품 문구는 예전 그대로다', () => {
    expect(referenceDeletePrompt({ title: '가', kind: '개념', source_key: null }))
      .toBe('"가" 개념 정리를 지울까요?\n되돌릴 수 없습니다.');
    expect(referenceDeletePrompt({ title: '나', kind: '작품', source_key: null }))
      .toBe('"나" 전문을 지울까요?\n되돌릴 수 없고, 문제 만들기에서 참고자료로 쓸 수 없게 됩니다.');
  });
});

describe('referenceAttachSlot', () => {
  it('여백 글만 오른쪽 칸이고 제재 정리는 맨 위다', () => {
    expect(referenceAttachSlot({ source_key: '평가문제집|동아|중2-1학기|묶음|여백|1. 가 > (1) 나' })).toBe('wing');
    expect(referenceAttachSlot({ source_key: '평가문제집|동아|중2-1학기|묶음|작품|1. 가 > (1) 나|동백꽃|김유정' })).toBe('top');
  });

  it('모르는 열쇠는 맨 위다 — 오른쪽 칸은 도구가 지은 여백 글만', () => {
    expect(referenceAttachSlot({ source_key: null })).toBe('top');
    expect(referenceAttachSlot({ source_key: '평가문제집|동아|동아-1-1|개념|10' })).toBe('top');
  });
});
