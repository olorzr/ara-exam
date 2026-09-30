import { describe, expect, it } from 'vitest';
import { excerptHtml, htmlToExcerptText } from './html-excerpt';

describe('htmlToExcerptText', () => {
  it('발문의 &lt;보기&gt; 를 꺾쇠 글자로 보여 준다', () => {
    expect(htmlToExcerptText('<p>윗글을 바탕으로 &lt;보기&gt;를 이해한 내용으로</p>'))
      .toBe('윗글을 바탕으로 <보기>를 이해한 내용으로');
  });

  it('태그를 먼저 걷고 엔티티를 푼다 — 인용된 &lt;u&gt; 가 태그로 오인돼 사라지지 않는다', () => {
    expect(htmlToExcerptText('<p><u>밑줄</u> &lt;u&gt;</p>')).toBe('밑줄 <u>');
  });

  it('문단·줄바꿈·nbsp 를 한 칸으로 접는다', () => {
    expect(htmlToExcerptText('<p>가</p><p>나&nbsp;&nbsp;다</p>\n<p>라</p>')).toBe('가 나 다 라');
  });

  it('유니코드 꺾쇠는 그대로 둔다', () => {
    expect(htmlToExcerptText('<p>〈보기〉 ＜보기＞ 「봄봄」</p>')).toBe('〈보기〉 ＜보기＞ 「봄봄」');
  });
});

describe('excerptHtml', () => {
  it('상한을 넘으면 … 으로 자른다', () => {
    expect(excerptHtml('<p>가나다라마</p>', 3)).toBe('가나다…');
  });

  it('상한 이하면 그대로', () => {
    expect(excerptHtml('<p>가나다</p>', 3)).toBe('가나다');
  });

  it('자르는 길이는 엔티티를 푼 뒤 글자로 센다', () => {
    expect(excerptHtml('<p>&lt;보기&gt;</p>', 4)).toBe('<보기>');
  });
});
