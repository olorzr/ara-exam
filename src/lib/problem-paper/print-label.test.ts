import { describe, expect, it } from 'vitest';
import { paperPrintLabel, type PaperPrintLabelInput } from './print-label';

const READY: PaperPrintLabelInput = {
  coverLoading: false, coverNeedsCheck: false, coverImagePending: false,
  imagesPending: false, fontsPending: false, booklet: false,
};

describe('paperPrintLabel', () => {
  it('준비가 끝났으면 인쇄 방식을 말한다', () => {
    expect(paperPrintLabel(READY)).toBe('인쇄');
    expect(paperPrintLabel({ ...READY, booklet: true })).toBe('인쇄 (A3 중철)');
  });

  it('잠긴 까닭은 먼저 풀어야 하는 것부터 말한다', () => {
    expect(paperPrintLabel({ ...READY, coverLoading: true, imagesPending: true })).toBe('표지 준비 중…');
    expect(paperPrintLabel({ ...READY, coverNeedsCheck: true, fontsPending: true })).toBe('표지 확인 필요');
    expect(paperPrintLabel({ ...READY, coverImagePending: true })).toBe('표지 준비 중…');
    expect(paperPrintLabel({ ...READY, imagesPending: true, fontsPending: true })).toBe('이미지 준비 중…');
    expect(paperPrintLabel({ ...READY, fontsPending: true, booklet: true })).toBe('글꼴 준비 중…');
  });
});
