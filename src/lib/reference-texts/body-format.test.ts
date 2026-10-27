import { describe, it, expect } from 'vitest';
import { bodyLength, bodyPlainText, htmlToText, normalizeTags, parseSeq, textToHtml } from './body-format';

describe('textToHtml', () => {
  it('빈 줄은 문단, 줄바꿈은 <br> — 시의 행갈이를 지킨다', () => {
    expect(textToHtml('나 보기가\n역겨워\n\n가실 때에는')).toBe('<p>나 보기가<br>역겨워</p><p>가실 때에는</p>');
  });

  it('⚠️ 태그로 읽힐 글자는 이스케이프한다 — 〈보기〉 꺾쇠가 사라지지 않게', () => {
    expect(textToHtml('<보기> & "인용"')).toBe('<p>&lt;보기&gt; &amp; &quot;인용&quot;</p>');
  });

  it('빈 글이면 빈 문자열', () => {
    expect(textToHtml('  \n\n ')).toBe('');
  });
});

describe('htmlToText · bodyPlainText', () => {
  it('표는 칸 구분을 남겨 평문으로', () => {
    expect(htmlToText('<table><tbody><tr><td>갈래</td><td>시</td></tr></tbody></table>')).toContain('갈래');
  });

  it('형식이 html 이면 보이는 글자만, text 면 그대로', () => {
    expect(bodyPlainText('<p></p>', 'html').trim()).toBe('');
    expect(bodyPlainText('<p></p>', 'text')).toBe('<p></p>');
  });
});

describe('parseSeq · normalizeTags', () => {
  it('차례 — 빈칸은 null, 0~9999 정수만', () => {
    expect(parseSeq('')).toBeNull();
    expect(parseSeq(' 0 ')).toBe(0);
    expect(parseSeq('9999')).toBe(9999);
    expect(parseSeq('10000')).toBe('invalid');
    expect(parseSeq('a')).toBe('invalid');
  });

  it('태그 — 공백을 다듬고 30자에서 자른다', () => {
    expect(normalizeTags(['  더 읽어  보기 ', '가'.repeat(40)])).toEqual(['더 읽어 보기', '가'.repeat(30)]);
  });
});

describe('평문 ↔ 서식 왕복 (코덱스 2R)', () => {
  it('⚠️ 연 구분(빈 줄)과 행 구분이 제자리로 돌아온다', () => {
    const poem = '나 보기가\n역겨워\n\n가실 때에는\n말없이';
    expect(htmlToText(textToHtml(poem))).toBe(poem);
  });

  it('꺾쇠·& 도 글자 그대로 돌아온다', () => {
    expect(htmlToText(textToHtml('<보기> & "인용"'))).toBe('<보기> & "인용"');
  });

  it('표는 칸 · 줄, 목록은 - 로 글만 남긴다', () => {
    expect(htmlToText('<table><tbody><tr><th>갈래</th><td>시</td></tr><tr><th>주제</th><td>사랑</td></tr></tbody></table><ul><li>가</li><li>나</li></ul>'))
      .toBe('갈래 · 시\n주제 · 사랑\n\n- 가\n- 나');
  });

  it('⚠️ 빈 표·빈 목록·빈 제목만 있으면 보이는 글자가 없다 — 저장을 막는다', () => {
    expect(bodyPlainText('<table><tbody><tr><td></td><td></td></tr></tbody></table><ul><li></li></ul><h3></h3>', 'html')).toBe('');
    expect(bodyPlainText('<p>&nbsp;</p>', 'html')).toBe('');
  });
});

describe('보이는 글자 수 — 줄 안 서식은 칸을 만들지 않는다 (코덱스 4R)', () => {
  it('굵게·밑줄·색 칸은 글자 사이에 공백을 넣지 않는다', () => {
    expect(bodyPlainText('<p>피<strong>동</strong> <u>표현</u><span style="background-color: #fff">이</span>다</p>', 'html')).toBe('피동 표현이다');
    expect(bodyLength('<p>가<strong>나</strong></p>', 'html')).toBe(2);
  });

  it('문단·칸·줄바꿈은 공백 하나로 가른다', () => {
    expect(bodyPlainText('<p>가</p><p>나<br>다</p><table><tbody><tr><td>라</td><td>마</td></tr></tbody></table>', 'html')).toBe('가 나 다 라 마');
  });
});
