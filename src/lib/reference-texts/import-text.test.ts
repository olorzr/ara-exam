import { describe, it, expect } from 'vitest';
import { joinPageTexts, pdfImportVerdict } from './import-text';

describe('joinPageTexts', () => {
  it('쪽 사이를 빈 줄 하나로 잇는다', () => {
    expect(joinPageTexts(['첫 쪽', '둘째 쪽'])).toBe('첫 쪽\n\n둘째 쪽');
  });

  it('빈 쪽(표지·간지)은 건너뛴다 — 그대로 이으면 빈 줄만 남는다', () => {
    expect(joinPageTexts(['첫 쪽', '   ', '', '셋째 쪽'])).toBe('첫 쪽\n\n셋째 쪽');
  });

  it('건진 쪽이 없으면 빈 문자열', () => {
    expect(joinPageTexts(['', '  '])).toBe('');
  });
});

describe('pdfImportVerdict', () => {
  it('한 쪽도 못 읽으면 스캔본이라고 알리고 갈 길을 말한다', () => {
    const v = pdfImportVerdict({ pageCount: 12, pagesWithText: 0 });
    expect(v.level).toBe('error');
    // "못 읽었어요" 로 끝내면 선생님은 파일이 잘못된 줄 안다
    expect(v.text).toContain('학교 프린트 시험지');
  });

  it('일부만 읽었으면 몇 쪽이 빠졌는지 짚는다', () => {
    const v = pdfImportVerdict({ pageCount: 10, pagesWithText: 7 });
    expect(v.level).toBe('warning');
    expect(v.text).toContain('3쪽은 글자가 없어');
  });

  it('다 읽었으면 쪽 수를 알린다', () => {
    const v = pdfImportVerdict({ pageCount: 4, pagesWithText: 4 });
    expect(v.level).toBe('success');
    expect(v.text).toContain('4쪽');
  });
});
