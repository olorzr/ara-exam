import { describe, it, expect } from 'vitest';
import { EXAM_SLOT_OPTIONS, slotOptionsForGrade } from './types';

// 자유학기제 규칙 — 중1 은 1학기 중간·기말고사가 없다.
// ⚠️ ara-system app/lib/examScope.ts 의 isSlotHiddenForGrade 와 같은 규칙의 교차 저장소 복제.
//    한쪽만 바뀌면 두 앱의 시험 목록이 어긋나므로 이 테스트가 규칙을 고정한다.

describe('slotOptionsForGrade', () => {
  it('중1 은 2학기 시험만 고를 수 있다', () => {
    const options = slotOptionsForGrade('중1');
    expect(options.map((o) => o.key)).toEqual(['2-중간', '2-기말']);
    expect(options.every((o) => o.semester === 2)).toBe(true);
  });

  it('다른 학년은 4개 시험 그대로', () => {
    for (const grade of ['중2', '중3', '고1', '고2', '고3']) {
      expect(slotOptionsForGrade(grade)).toEqual(EXAM_SLOT_OPTIONS);
    }
  });

  it('학년 미선택(빈 문자열)이면 전체를 준다 — 고르기 전에는 좁히지 않는다', () => {
    expect(slotOptionsForGrade('')).toEqual(EXAM_SLOT_OPTIONS);
  });

  it('원본 배열을 변형하지 않는다', () => {
    const before = EXAM_SLOT_OPTIONS.map((o) => o.key);
    slotOptionsForGrade('중1');
    expect(EXAM_SLOT_OPTIONS.map((o) => o.key)).toEqual(before);
  });
});
