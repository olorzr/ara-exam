import { describe, expect, it } from 'vitest';
import { sanitizeConceptHTML } from './sanitize-html';
import { sanitizeInlineHTML, sanitizeProblemHTML } from './sanitize-problem';
import { sanitizeReferenceHTML } from './sanitize-reference';

/** 평가문제집 쪽 한 장의 구성 일곱 가지 — 노미숙 1-(1) '시의 목소리' 에서 */
const WORKBOOK = [
  '<h3>화자의 개념과 역할</h3>',
  '<h4>개념</h4><p>시에서 말하는 이로, 시인이 내세운 <mark>존재</mark></p>',
  '<blockquote data-callout="학습 목표" data-tone="goal"><p>보는 이나 말하는 이의 <u>특성</u>과 효과를 파악한다.</p></blockquote>',
  '<table data-layout="vocab"><tbody><tr><td>화자 <small>(話 말할 화, 者 사람 자)</small></td><td>이야기를 하는 사람.</td></tr></tbody></table>',
  '<table data-layout="gloss"><tbody><tr><td><p>아빠 구두는 고래잡이 통통배</p></td><td><p>1~2연: 귀가한 부모님의 구두가 현관에 놓여 있음.</p></td></tr></tbody></table>',
  '<ul data-flow="down"><li><p>듣기·말하기 전</p></li><li><p>듣기·말하기 중</p></li></ul>',
  '<table><tbody><tr><th>갈래</th><td>자유시, 서정시</td></tr></tbody></table>',
].join('');

/** 「저녁 항구」 — 아래·위 풀이, 줄 밑줄 안의 부분 풀이, 표식 다섯 */
const PHRASES = [
  '<p><span data-note="부모님의 구두">배들이</span><br>닻을 내리고 쉬고 있다 <span data-note="항구" data-note-pos="over">우리 집 현관</span>에서</p>',
  '<p>열린 문틈으로 <span data-note="시각적 심상"><u>푸른 파도가</u></span><u> 밀려오고</u></p>',
  '<p><span data-shape="box">바다</span> <span data-shape="circle">항구</span> <span data-shape="triangle">소금</span> ',
  '<span data-shape="diamond">암초</span> <span data-shape="star">자국</span></p>',
].join('');

describe('sanitizeReferenceHTML', () => {
  it('문제집 구성 일곱 가지가 글자 하나 안 바뀌고 남는다 — 적재 검사가 왕복 = 입력을 본다', () => {
    expect(sanitizeReferenceHTML(WORKBOOK)).toBe(WORKBOOK);
  });

  it('문항 서식(〈보기〉 상자·(가) 구역·나란히 표·그림 자리)도 그대로 받는다', () => {
    const html = '<blockquote data-box="보기"><p>ㄱ</p></blockquote><blockquote data-box="가"><p>시</p></blockquote>'
      + '<table data-layout="verse"><tbody><tr><td>生死</td><td>생사</td></tr></tbody></table><figure data-figure="1"></figure>';
    expect(sanitizeReferenceHTML(html)).toBe(html);
  });

  it('상자 안의 〈보기〉 상자도 남는다', () => {
    const html = '<blockquote data-callout="한 걸음 더" data-tone="more"><blockquote data-box="보기"><p>가</p></blockquote></blockquote>';
    expect(sanitizeReferenceHTML(html)).toBe(html);
  });

  it('말머리·색 갈래는 blockquote 에서만, 아는 값만', () => {
    expect(sanitizeReferenceHTML('<p data-callout="학습 목표">가</p>')).toBe('<p>가</p>');
    expect(sanitizeReferenceHTML('<blockquote data-tone="red"><p>가</p></blockquote>')).toBe('<blockquote><p>가</p></blockquote>');
    expect(sanitizeReferenceHTML(`<blockquote data-callout="${'가'.repeat(25)}"><p>가</p></blockquote>`))
      .not.toContain('data-callout');
    expect(sanitizeReferenceHTML('<blockquote data-callout="a&quot;b"><p>가</p></blockquote>')).not.toContain('data-callout');
  });

  it('도식 방향은 ul 에서 down·right 만', () => {
    expect(sanitizeReferenceHTML('<ul data-flow="up"><li>가</li></ul>')).toBe('<ul><li>가</li></ul>');
    expect(sanitizeReferenceHTML('<ol data-flow="down"><li>가</li></ol>')).toBe('<ol><li>가</li></ol>');
  });

  it('표 모양은 table 에서 verse·gloss·vocab 만', () => {
    expect(sanitizeReferenceHTML('<table data-layout="grid"><tbody><tr><td>가</td></tr></tbody></table>'))
      .not.toContain('data-layout');
    expect(sanitizeReferenceHTML('<p data-layout="gloss">가</p>')).toBe('<p>가</p>');
  });

  it('구절 풀이·표식이 글자 하나 안 바뀌고 남는다 — 적재 검사가 왕복 = 입력을 본다', () => {
    expect(sanitizeReferenceHTML(PHRASES)).toBe(PHRASES);
  });

  it('구절 풀이·표식은 span 에서만', () => {
    expect(sanitizeReferenceHTML('<p><u data-note="가">나</u></p>')).toBe('<p><u>나</u></p>');
    expect(sanitizeReferenceHTML('<p><mark data-shape="box">나</mark></p>')).toBe('<p><mark>나</mark></p>');
    expect(sanitizeReferenceHTML('<p data-note-pos="over">나</p>')).toBe('<p>나</p>');
  });

  it('⚠️ 한 span 에 풀이와 표식을 함께 두면 표식을 걷는다 — 같은 ::before 를 두고 부딪힌다', () => {
    for (const html of [
      '<p><span data-note="뜻" data-note-pos="over" data-shape="star">말</span></p>',
      '<p><span data-shape="star" data-note-pos="over" data-note="뜻">말</span></p>',
    ]) {
      const out = sanitizeReferenceHTML(html);
      expect(out).not.toContain('data-shape');
      expect(out).toContain('data-note="뜻"');
    }
    const nested = '<p><span data-note="뜻"><span data-shape="star">말</span></span></p>';
    expect(sanitizeReferenceHTML(nested)).toBe(nested);
  });

  it("⚠️ 쌍점이 든 풀이를 주소로 오해하지 않는다 — 'A: 화자' 가 저장할 때 말없이 사라졌다", () => {
    for (const note of ['A: 화자', 'S: 주어', 'a:b', 'http://example.com']) {
      const html = `<p><span data-note="${note}">말</span></p>`;
      expect(sanitizeReferenceHTML(html)).toBe(html);
    }
  });

  it('주소 검사를 뺀 것은 풀이뿐이다 — 다른 data 속성과 문항 프로필은 그대로다', () => {
    expect(sanitizeReferenceHTML('<blockquote data-callout="A: 화자"><p>가</p></blockquote>')).not.toContain('data-callout');
    expect(sanitizeProblemHTML('<p><span data-note="A: 화자">말</span></p>')).not.toContain('data-note');
  });

  it('구절 풀이·표식은 아는 값만', () => {
    for (const bad of [
      '<span data-note="">가</span>', `<span data-note="${'가'.repeat(61)}">가</span>`, '<span data-note=" 앞 공백">가</span>',
      '<span data-note="\ue000">가</span>', '<span data-shape="square">가</span>', '<span data-note="나" data-note-pos="under">가</span>',
    ]) {
      expect(sanitizeReferenceHTML(`<p>${bad}</p>`)).not.toMatch(/data-(shape|note-pos)|data-note="(|\s.*|.{61,}|\ue000)"/);
    }
  });

  it('⚠️ 풀이의 따옴표·꺾쇠가 속성을 빠져나가지 않는다', () => {
    const out = sanitizeReferenceHTML('<p><span data-note="&quot;&gt;&lt;img src=x onerror=y&gt;">가</span></p>');
    const host = document.createElement('div');
    host.innerHTML = out;
    expect(host.querySelector('img')).toBeNull();
    expect(host.querySelector('span')?.textContent).toBe('가');
  });

  it('위험한 것은 여전히 막는다', () => {
    expect(sanitizeReferenceHTML('<script>x</script><p onclick="y">가</p><img src="z" onerror="w">')).toBe('<p>가</p>');
    expect(sanitizeReferenceHTML('<mark class="fixed inset-0" data-concept>가</mark>')).toBe('<mark>가</mark>');
    expect(sanitizeReferenceHTML('<p style="position: fixed">가</p>')).toBe('<p>가</p>');
  });

  it('빈 입력은 빈 문자열', () => {
    expect(sanitizeReferenceHTML('')).toBe('');
  });
});

describe('문항 프로필은 그대로다 — 참고자료 표시가 하나도 안 샌다', () => {
  it('말머리 상자·도식·여백 해설·어휘 표·mark·small 이 전부 걷히고 글자만 남는다', () => {
    const out = sanitizeProblemHTML(WORKBOOK);
    for (const leak of ['data-callout', 'data-tone', 'data-flow', 'gloss', 'vocab', '<mark', '<small']) {
      expect(out).not.toContain(leak);
    }
    expect(out).toContain('이야기를 하는 사람.');
    expect(out).toContain('(話 말할 화, 者 사람 자)');
  });
});

describe('문항 프로필은 구절 풀이·표식도 받지 않는다', () => {
  it('속성만 걷히고 글자는 남는다', () => {
    for (const out of [sanitizeProblemHTML(PHRASES), sanitizeInlineHTML(PHRASES)]) {
      for (const leak of ['data-note', 'data-shape', '시각적 심상']) expect(out).not.toContain(leak);
      expect(out).toContain('푸른 파도가');
    }
  });
});

describe('프로필 격리 — 훅이 하나뿐이라 호출 순서가 섞이기 쉽다', () => {
  it('참고자료 → 문항 → 개념지 → 참고자료 순으로 불러도 각자 규칙 그대로', () => {
    expect(sanitizeReferenceHTML(WORKBOOK)).toBe(WORKBOOK);
    expect(sanitizeProblemHTML('<blockquote data-callout="학습 목표"><p>가</p></blockquote>')).not.toContain('data-callout');
    expect(sanitizeProblemHTML('<p><span data-note="가">나</span></p>')).not.toContain('data-note');
    expect(sanitizeConceptHTML('<p><mark data-concept>가</mark></p>')).toContain('data-concept');
    expect(sanitizeConceptHTML('<blockquote data-callout="학습 목표"><p>가</p></blockquote>')).not.toContain('data-callout');
    expect(sanitizeReferenceHTML(WORKBOOK)).toBe(WORKBOOK);
  });
});
