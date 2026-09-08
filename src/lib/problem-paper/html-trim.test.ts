import { describe, it, expect } from 'vitest';
import { isEmptyParagraph, stripTrailingEmptyParagraphs, trimEdgeEmptyParagraphs } from './html-trim';

describe('isEmptyParagraph', () => {
  it('빈 문단의 여러 모양을 알아본다', () => {
    expect(isEmptyParagraph('<p></p>')).toBe(true);
    expect(isEmptyParagraph('<p> </p>')).toBe(true);
    expect(isEmptyParagraph('<p><br></p>')).toBe(true);
    expect(isEmptyParagraph('<p style="text-align: center"></p>')).toBe(true);
  });

  it('내용이 있으면 아니다', () => {
    expect(isEmptyParagraph('<p>가</p>')).toBe(false);
    expect(isEmptyParagraph('<blockquote></blockquote>')).toBe(false);
    expect(isEmptyParagraph('<p></p><p>가</p>')).toBe(false);
  });
});

describe('trimEdgeEmptyParagraphs', () => {
  it('앞뒤의 빈 문단만 걷어낸다 — 가운데는 원문의 빈 줄이다', () => {
    expect(trimEdgeEmptyParagraphs(['<p></p>', '<p>연 하나</p>', '<p></p>', '<p>연 둘</p>', '<p><br></p>']))
      .toEqual(['<p>연 하나</p>', '<p></p>', '<p>연 둘</p>']);
  });

  it('전부 빈 문단이면 빈 목록', () => {
    expect(trimEdgeEmptyParagraphs(['<p></p>', '<p> </p>'])).toEqual([]);
  });

  it('빈 문단이 없으면 그대로', () => {
    const parts = ['<p>가</p>', '<p>나</p>'];
    expect(trimEdgeEmptyParagraphs(parts)).toEqual(parts);
  });
});

describe('stripTrailingEmptyParagraphs', () => {
  it('끝에 붙은 빈 문단을 걷어낸다 — 편집기가 표 뒤에 자동으로 붙인다', () => {
    expect(stripTrailingEmptyParagraphs('<p>물음?</p><p></p>')).toBe('<p>물음?</p>');
    expect(stripTrailingEmptyParagraphs('<p>물음?</p><p><br></p><p> </p>')).toBe('<p>물음?</p>');
  });

  it('가운데 빈 문단은 남긴다', () => {
    const html = '<p>가</p><p></p><p>나</p>';
    expect(stripTrailingEmptyParagraphs(html)).toBe(html);
  });

  it('빈 입력은 그대로', () => {
    expect(stripTrailingEmptyParagraphs('')).toBe('');
  });
});
