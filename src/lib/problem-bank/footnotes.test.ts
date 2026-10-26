import { describe, expect, it } from 'vitest';
import { isFootnoteLine, markFootnotes } from './footnotes';

describe('isFootnoteLine', () => {
  it('별표 뒤 30자 안에 쌍점이 있으면 각주다', () => {
    expect(isFootnoteLine('* 품 진 : 품앗이를 한.')).toBe(true);
    expect(isFootnoteLine('*헤오시매: 헤아려 주시므로')).toBe(true);
    expect(isFootnoteLine('＊장대：長臺')).toBe(true);
  });

  it('쌍점이 없거나 너무 멀면 각주가 아니다', () => {
    expect(isFootnoteLine('* 수수 동부 녹두 참깨 부룩 을 적게 하소')).toBe(false);
    expect(isFootnoteLine(`*${'가'.repeat(31)}: 풀이`)).toBe(false);
    expect(isFootnoteLine('품앗이 : 별표 없음')).toBe(false);
  });
});

describe('markFootnotes', () => {
  it('문단 전체가 각주면 그 문단을 작게 표시한다', () => {
    const html = '<p>본문</p><p>* 품 진 : 품앗이를 한.<br> * 부룩 : 사이짓기.</p>';
    expect(markFootnotes(html)).toBe(
      '<p>본문</p><p class="pb-note">* 품 진 : 품앗이를 한.<br> * 부룩 : 사이짓기.</p>',
    );
  });

  it('한 줄에 각주 둘이 이어져도 각주다', () => {
    const html = '<p>* 불일성지 : 며칠 안 되어 일이 이루어짐. * 장계 : 신하가 올리는 문서.</p>';
    expect(markFootnotes(html)).toContain('class="pb-note"');
  });

  it('시 문단 끝에 <br> 로 붙은 각주 줄만 떼어 작은 문단으로 만든다', () => {
    const html = '<p>임이 헤오시매* 나는 전혀 믿었더니<br>날 사랑하던 정을<br>*헤오시매: 헤아려 주시므로</p>';
    expect(markFootnotes(html)).toBe(
      '<p>임이 헤오시매* 나는 전혀 믿었더니<br>날 사랑하던 정을</p><p class="pb-note">*헤오시매: 헤아려 주시므로</p>',
    );
  });

  it('시구 사이의 * 줄 뒤에 본문이 이어지면 건드리지 않는다', () => {
    const html = '<p>갈 꺾어 거름할 제<br>* 부룩 : 사이짓기<br>물 댄 논을 써레질하고</p>';
    expect(markFootnotes(html)).toBe(html);
  });

  it('쌍점 없는 * 줄은 각주가 아니다', () => {
    const html = '<p>* 수수 동부 녹두 참깨 부룩 을 적게 하소<br>갈 꺾어 거름할 제</p>';
    expect(markFootnotes(html)).toBe(html);
  });

  it('구역 상자 안의 각주도 표시한다', () => {
    const html = '<blockquote data-box="가"><p>시 본문</p><p>* 서도 : 황해도와 평안도.</p></blockquote>';
    expect(markFootnotes(html)).toContain('<p class="pb-note">* 서도 : 황해도와 평안도.</p>');
  });

  it('표 칸 안의 글은 보지 않는다', () => {
    const html = '<table data-layout="verse"><tbody><tr><td><p>* 가 : 나</p></td></tr></tbody></table>';
    expect(markFootnotes(html)).toBe(html);
  });

  it('꾸밈 태그 안에서 줄이 바뀌는 문단은 건드리지 않는다 — 본문이 각주로 작아지면 안 된다', () => {
    const html = '<p>본문<br><u>* 낱말: 풀이<br>다음 시구</u></p>';
    expect(markFootnotes(html)).toBe(html);
    const whole = '<p><u>* 낱말: 풀이<br>다음 시구</u></p>';
    expect(markFootnotes(whole)).toBe(whole);
  });

  it('두 번 불러도 같다', () => {
    const html = '<p>본문<br>* 서도 : 황해도와 평안도.</p>';
    const once = markFootnotes(html);
    expect(markFootnotes(once)).toBe(once);
  });

  it('각주가 없으면 들어온 글자 그대로다', () => {
    const html = '<p>별표 * 가 있지만 각주는 아님</p>';
    expect(markFootnotes(html)).toBe(html);
  });
});
