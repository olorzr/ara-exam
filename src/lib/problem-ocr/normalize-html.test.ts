import { describe, it, expect } from 'vitest';
import {
  defaultStemBoxes, normalizeBlankParagraphs, normalizeOcrPassageHtml, normalizeOcrStemHtml, stripPrintedScore,
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

describe('defaultStemBoxes — 발문 안 말머리 없는 상자', () => {
  it('맨 blockquote 를 〈보기〉로 삼는다 — 인쇄 CSS 는 data-box 만 상자로 그린다', () => {
    expect(defaultStemBoxes('<p>다음 문장에 나타나지 않는 것은?</p><blockquote><p>드디어 동네가 옛 모습을 되찾았다.</p></blockquote>'))
      .toBe('<p>다음 문장에 나타나지 않는 것은?</p><blockquote data-box="보기"><p>드디어 동네가 옛 모습을 되찾았다.</p></blockquote>');
  });

  it('말머리가 이미 있으면 그대로 둔다 (자료·(가)·[A] 도)', () => {
    const html = '<blockquote data-box="자료"><p>ㄱ</p></blockquote><blockquote data-box="가"><p>ㄴ</p></blockquote>';
    expect(defaultStemBoxes(html)).toBe(html);
  });

  it('상자가 여럿이면 빠진 것만 채운다', () => {
    expect(defaultStemBoxes('<blockquote data-box="보기 1"><p>ㄱ</p></blockquote><blockquote><p>ㄴ</p></blockquote>'))
      .toBe('<blockquote data-box="보기 1"><p>ㄱ</p></blockquote><blockquote data-box="보기"><p>ㄴ</p></blockquote>');
  });

  it('대문자 태그도 잡는다 — 빠른 탈출이 정규식보다 좁으면 그 상자만 빠진다(코덱스 3R)', () => {
    expect(defaultStemBoxes('<BLOCKQUOTE><p>ㄱ</p></BLOCKQUOTE>'))
      .toBe('<BLOCKQUOTE data-box="보기"><p>ㄱ</p></BLOCKQUOTE>');
  });

  it('다른 속성이 붙어 있어도 잡는다 — 속성 순서를 가리지 않는다', () => {
    expect(defaultStemBoxes('<blockquote style="text-align:center"><p>ㄱ</p></blockquote>'))
      .toBe('<blockquote data-box="보기" style="text-align:center"><p>ㄱ</p></blockquote>');
  });

  it('발문 다듬기는 허용 목록 밖 말머리를 〈보기〉로 받는다 — 지우기가 먼저, 채우기가 뒤', () => {
    expect(normalizeOcrStemHtml('<p>물음?</p><blockquote data-box="활동지"><p>ㄱ</p></blockquote>'))
      .toBe('<p>물음?</p><blockquote data-box="보기"><p>ㄱ</p></blockquote>');
  });

  it('따옴표 없는 허용 밖 말머리도 〈보기〉로 받는다 — 정규화기가 먼저 지워 준다(코덱스 2R)', () => {
    expect(normalizeOcrStemHtml('<p>물음?</p><blockquote data-box=ⓐ><p>ㄱ</p></blockquote>'))
      .toBe('<p>물음?</p><blockquote data-box="보기"><p>ㄱ</p></blockquote>');
    expect(normalizeOcrStemHtml('<p>물음?</p><blockquote data-box=(가)><p>ㄱ</p></blockquote>'))
      .toBe('<p>물음?</p><blockquote data-box="가"><p>ㄱ</p></blockquote>');
  });

  it('빈 말머리(data-box=)도 〈보기〉로 받는다(코덱스 4R)', () => {
    expect(normalizeOcrStemHtml('<p>물음?</p><blockquote data-box=><p>ㄱ</p></blockquote>'))
      .toBe('<p>물음?</p><blockquote data-box="보기"><p>ㄱ</p></blockquote>');
    expect(normalizeOcrStemHtml('<p>물음?</p><blockquote data-box><p>ㄱ</p></blockquote>'))
      .toBe('<p>물음?</p><blockquote data-box="보기"><p>ㄱ</p></blockquote>');
  });

  it('지문 다듬기는 맨 blockquote 를 건드리지 않는다 — 지문 안 인용 글일 수 있다', () => {
    const html = '<blockquote><p>인용</p></blockquote>';
    expect(normalizeOcrPassageHtml(html)).toBe(html);
  });
});

describe('normalizeOcrPassageHtml — 옛한글', () => {
  it('대체 표기를 자모로 바꾼다 (정화보다 먼저 도는 자리다)', () => {
    expect(normalizeOcrPassageHtml('<p>⟦ㅎㆍㄴ⟧</p>')).toBe('<p>\u1112\u119E\u11AB</p>');
  });

  it('상자 말머리 다듬기와 함께 돈다 — 순서가 어긋나면 한쪽이 조용히 사라진다', () => {
    const html = normalizeOcrPassageHtml('<blockquote data-box="(가)"><p>⟦ㅅㆍ⟧</p></blockquote>');
    expect(html).toContain('data-box="가"');
    expect(html).toContain('\u1109\u119E');
  });
});
