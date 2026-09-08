import { describe, it, expect } from 'vitest';
import {
  normalizeBlankParagraphs, normalizeOcrPassageHtml, normalizeOcrStemHtml, stripPrintedScore,
} from './normalize-html';

describe('stripPrintedScore', () => {
  it('발문 끝의 배점을 지운다', () => {
    expect(stripPrintedScore('윗글에 대한 설명으로 적절하지 않은 것은? (3.4점)'))
      .toBe('윗글에 대한 설명으로 적절하지 않은 것은?');
  });

  it('닫는 태그 앞에서도 지운다', () => {
    expect(stripPrintedScore('<p>물음? (3.4점)</p>')).toBe('<p>물음?</p>');
  });

  it('〈보기〉 상자 앞에서도 지운다 — 배점 뒤에 상자가 붙는 문항이 흔하다', () => {
    expect(stripPrintedScore('물음? (3.7점)<blockquote><p>가</p></blockquote>'))
      .toBe('물음?<blockquote><p>가</p></blockquote>');
  });

  it('대괄호·전각 괄호도 지운다', () => {
    expect(stripPrintedScore('<p>물음? [3점]</p>')).toBe('<p>물음?</p>');
    expect(stripPrintedScore('<p>물음? （3점）</p>')).toBe('<p>물음?</p>');
  });

  it('서술형처럼 여러 번 나오면 모두 지운다', () => {
    expect(stripPrintedScore('<p>(1) 가 (4점)</p><p>(2) 나 (4점)</p>'))
      .toBe('<p>(1) 가</p><p>(2) 나</p>');
  });

  it('문장 가운데 배점 표기는 그대로 둔다 — 본문을 고치면 안 된다', () => {
    const html = '<p>다음 중 (3점)짜리 문항은?</p>';
    expect(stripPrintedScore(html)).toBe(html);
  });
});

describe('normalizeBlankParagraphs', () => {
  it('공백만 든 문단을 빈 문단으로 만든다 — CSS :empty 가 공백을 못 잡는다', () => {
    expect(normalizeBlankParagraphs('<p>가</p><p> </p><p>나</p>'))
      .toBe('<p>가</p><p></p><p>나</p>');
  });

  it('<br> 하나뿐인 문단도 빈 문단이다', () => {
    expect(normalizeBlankParagraphs('<p><br></p>')).toBe('<p></p>');
    expect(normalizeBlankParagraphs('<p><br/></p>')).toBe('<p></p>');
  });

  it('&nbsp; 만 든 문단도 빈 문단이다', () => {
    expect(normalizeBlankParagraphs('<p>&nbsp;</p>')).toBe('<p></p>');
  });

  it('속성이 붙은 빈 문단도 통일한다', () => {
    expect(normalizeBlankParagraphs('<p style="text-align: center"> </p>')).toBe('<p></p>');
  });

  it('내용이 있으면 건드리지 않는다', () => {
    const html = '<p>시행 하나<br>시행 둘</p>';
    expect(normalizeBlankParagraphs(html)).toBe(html);
  });
});

describe('normalizeOcrPassageHtml / normalizeOcrStemHtml', () => {
  it('지문은 상자 말머리와 빈 문단을 함께 다듬는다', () => {
    const out = normalizeOcrPassageHtml('<blockquote data-box="(가)"><p>연 하나</p><p> </p></blockquote>');
    expect(out).toBe('<blockquote data-box="가"><p>연 하나</p><p></p></blockquote>');
  });

  it('발문은 배점까지 지운다', () => {
    expect(normalizeOcrStemHtml('<p>물음? (3.4점)</p><blockquote data-box="〈보기〉">가</blockquote>'))
      .toBe('<p>물음?</p><blockquote data-box="보기">가</blockquote>');
  });

  it('빈 입력은 빈 문자열', () => {
    expect(normalizeOcrStemHtml('')).toBe('');
  });
});
