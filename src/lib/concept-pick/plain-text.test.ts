import { describe, it, expect } from 'vitest';
import { htmlToPlainText } from './plain-text';

describe('htmlToPlainText', () => {
  it('문단과 줄바꿈을 줄로 바꾼다', () => {
    expect(htmlToPlainText('<p>가</p><p>나<br>다</p>')).toBe('가\n나\n다');
  });

  it('표의 칸은 탭으로 가른다 — 붙이면 두 칸의 글자가 한 낱말처럼 보인다', () => {
    const text = htmlToPlainText('<table><tbody><tr><td>갈래</td><td>서정시</td></tr></tbody></table>');
    expect(text).toContain('갈래\t서정시');
  });

  it('서식 태그는 지우고 글자만 남긴다 — 본문에 있는가 판정의 기준이다', () => {
    expect(htmlToPlainText('<p>이 시의 <strong>갈래</strong>는 <u>서정시</u></p>'))
      .toBe('이 시의 갈래는 서정시');
  });

  it('엔티티를 되돌린다 — 안 풀면 그 글자가 든 용어가 영영 "본문에 없음" 이 된다', () => {
    expect(htmlToPlainText('<p>A&amp;B</p>')).toBe('A&B');
    expect(htmlToPlainText('<p>&lt;보기&gt;</p>')).toBe('<보기>');
    expect(htmlToPlainText('<p>가&nbsp;나</p>')).toBe('가 나');
  });

  it('&amp; 를 마지막에 푼다 — 먼저 풀면 &amp;lt; 가 두 번 풀려 < 가 된다', () => {
    expect(htmlToPlainText('<p>&amp;lt;</p>')).toBe('&lt;');
  });

  it('빈 줄이 이어지면 하나로 줄인다', () => {
    expect(htmlToPlainText('<p>가</p><p></p><p></p><p>나</p>')).toBe('가\n\n나');
  });
});
