import { describe, expect, it } from 'vitest';
import { htmlToPlainText } from '@/lib/concept-pick/plain-text';
import { isHandwrittenSpan, readPlainWithHandwriting } from './handwriting';

/** 평문에서 그 말이 있는 자리 */
const spanOf = (plain: string, text: string) => {
  const start = plain.indexOf(text);
  return { start, end: start + text.length };
};

describe('readPlainWithHandwriting', () => {
  it('손글씨를 안 읽은 묶음에서는 <em> 을 보지 않는다 — 인쇄된 기울임일 뿐이다', () => {
    const html = '<p>답: <em>은유법</em></p>';
    expect(readPlainWithHandwriting(html, false).ranges).toEqual([]);
  });

  it('평문은 손글씨를 켜든 끄든 같다 — 표시 글자가 본문에 남으면 안 된다', () => {
    const html = '<p>1. 물음 답: <em>은유법</em></p><p>2. 물음</p>';
    expect(readPlainWithHandwriting(html, true).plain)
      .toBe(readPlainWithHandwriting(html, false).plain);
    expect(readPlainWithHandwriting(html, true).plain).toBe(htmlToPlainText(html));
  });

  it('손글씨 자리를 평문 좌표로 돌려준다', () => {
    const html = '<p>답: <em>은유법</em></p>';
    const { plain, ranges } = readPlainWithHandwriting(html, true);
    expect(ranges).toHaveLength(1);
    expect(plain.slice(ranges[0].start, ranges[0].end)).toBe('은유법');
  });

  it('⚠️ 엔티티·<br> 이 들어 있어도 본문과 같은 규칙으로 푼다', () => {
    const html = '<p>답: <em>관심&nbsp;표현</em></p>';
    const { plain, ranges } = readPlainWithHandwriting(html, true);
    expect(plain).toContain('관심 표현');
    expect(plain.slice(ranges[0].start, ranges[0].end)).toBe('관심 표현');
  });

  it('속이 빈 <em> 은 자리로 세지 않는다', () => {
    expect(readPlainWithHandwriting('<p>가<em> </em>나</p>', true).ranges).toEqual([]);
  });

  it('⚠️ 겹친 <em> 도 바깥 짝까지 통째로 손글씨다 (코덱스 2R)', () => {
    const html = '<p>답: <em>메모 <em>강조</em> 은유</em></p>';
    const { plain, ranges } = readPlainWithHandwriting(html, true);
    expect(ranges).toHaveLength(1);
    expect(plain.slice(ranges[0].start, ranges[0].end)).toBe('메모 강조 은유');
  });

  it('⚠️ 표시 글자가 공백을 늘리지 않는다 (코덱스 2R)', () => {
    const html = '<p>가 <em> 나 </em> 다</p>';
    expect(readPlainWithHandwriting(html, true).plain)
      .toBe(readPlainWithHandwriting(html, false).plain);
    expect(readPlainWithHandwriting(html, true).plain).toBe('가 나 다');
  });

  it('⚠️ 빈 줄이 늘어나지 않는다 — 속이 공백뿐인 <em> 은 표시하지 않는다', () => {
    const html = '<p>가</p><p><em>&nbsp;<br></em></p><p>나</p>';
    expect(readPlainWithHandwriting(html, true).plain)
      .toBe(readPlainWithHandwriting(html, false).plain);
  });

  it('닫히지 않은 <em> 은 글 끝까지로 본다', () => {
    const { plain, ranges } = readPlainWithHandwriting('<p>답: <em>은유법</p>', true);
    expect(ranges).toHaveLength(1);
    expect(plain.slice(ranges[0].start, ranges[0].end)).toBe('은유법');
  });
});

describe('isHandwrittenSpan', () => {
  const html = '<p>3. 표현법은? 답: 은유</p><p>7. 표현법은? 답: <em>은유</em></p>';
  const { plain, ranges } = readPlainWithHandwriting(html, true);

  it('⚠️ 같은 글자가 딴 데 손글씨로 있어도 인쇄된 답은 인쇄된 답이다 (코덱스 리뷰)', () => {
    // 3번의 '은유' 는 인쇄된 것 — 7번의 손글씨 때문에 뒤바뀌면 선생님 답이 AI 답으로 덮인다
    expect(isHandwrittenSpan(spanOf(plain, '은유'), ranges)).toBe(false);
  });

  it('그 자리의 답이 손글씨면 손글씨다', () => {
    expect(isHandwrittenSpan(ranges[0], ranges)).toBe(true);
  });

  it('손글씨 자리가 없으면 언제나 false', () => {
    expect(isHandwrittenSpan({ start: 0, end: 5 }, [])).toBe(false);
  });
});

describe('readPlainWithHandwriting — 엔티티 공백 (코덱스 3R)', () => {
  it('⚠️ &nbsp; 로 둘러싸인 손글씨도 공백을 늘리지 않는다', () => {
    const html = '<p>가 <em>&nbsp;나&nbsp;</em> 다</p>';
    expect(readPlainWithHandwriting(html, true).plain)
      .toBe(readPlainWithHandwriting(html, false).plain);
    expect(readPlainWithHandwriting(html, true).plain).toBe('가 나 다');
  });

  it('표 칸 안의 손글씨도 자리가 맞는다', () => {
    const html = '<table><tr><td>답</td><td><em>은유법</em></td></tr></table>';
    const { plain, ranges } = readPlainWithHandwriting(html, true);
    expect(plain).toBe(readPlainWithHandwriting(html, false).plain);
    expect(plain.slice(ranges[0].start, ranges[0].end)).toBe('은유법');
  });
});
