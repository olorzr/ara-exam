import { describe, it, expect } from 'vitest';
import { htmlToPlainText } from './plain-text';

describe('htmlToPlainText', () => {
  it('문단과 줄바꿈을 줄로 바꾼다', () => {
    expect(htmlToPlainText('<p>가</p><p>나<br>다</p>')).toBe('가\n나\n다');
  });

  it('표의 한 행은 한 줄이다 — TipTap 은 칸마다 <p> 를 넣으므로 칸을 먼저 접어야 짝이 산다', () => {
    const tiptap = '<table><tbody><tr>'
      + '<td colspan="1"><p><strong>시어</strong></p></td><td><p>꿈을 지닌 대상</p></td>'
      + '</tr></tbody></table>';
    expect(htmlToPlainText(tiptap)).toBe('| 시어 | 꿈을 지닌 대상 |');
  });

  it('칸 안의 줄바꿈은 공백이다 — 줄을 나누면 그 칸이 옆 칸과 흩어진다', () => {
    const html = '<table><tbody><tr><td><p>가<br>나</p><p>다</p></td></tr></tbody></table>';
    expect(htmlToPlainText(html)).toBe('| 가 나 다 |');
  });

  it('구분 기호는 앞뒤를 공백으로 띄운다 — 붙이면 그 낱말이 "본문에 없음" 이 된다', () => {
    const text = htmlToPlainText('<table><tbody><tr><td><p>서정시</p></td></tr></tbody></table>');
    expect(text.includes('서정시')).toBe(true);
    expect(text).not.toContain('|서정시');
  });

  it('제목과 목록에 표시를 남긴다 — 제목 자체는 고르지 말라고 할 수 있어야 한다', () => {
    expect(htmlToPlainText('<h3>제재 개관</h3>')).toBe('# 제재 개관');
    expect(htmlToPlainText('<h4>표현상 특징</h4>')).toBe('## 표현상 특징');
    expect(htmlToPlainText('<ul><li><p>의인법</p></li></ul>')).toBe('- 의인법');
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

  it('& 를 마지막에 푼다 — 먼저 풀면 &amp;lt; 가 두 번 풀려 < 가 된다', () => {
    expect(htmlToPlainText('<p>&amp;lt;</p>')).toBe('&lt;');
  });

  it('빈 줄이 이어지면 하나로 줄인다', () => {
    expect(htmlToPlainText('<p>가</p><p></p><p></p><p>나</p>')).toBe('가\n\n나');
  });
});
