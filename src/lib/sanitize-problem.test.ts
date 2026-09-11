import { describe, it, expect } from 'vitest';
import { sanitizeProblemHTML, sanitizeInlineHTML } from './sanitize-problem';
import { sanitizeConceptHTML } from './sanitize-html';

describe('sanitizeProblemHTML', () => {
  it('문단·밑줄·굵게를 유지한다 — 국어 문항의 기본 서식', () => {
    const html = '<p>다음 <u>밑줄 친</u> 부분의 <strong>의미</strong>는?</p>';
    expect(sanitizeProblemHTML(html)).toBe(html);
  });

  it('표를 유지한다(병합 셀 포함)', () => {
    const html = '<table><tbody><tr><td colspan="2">가</td></tr></tbody></table>';
    expect(sanitizeProblemHTML(html)).toContain('colspan="2"');
  });

  it('〈보기〉 상자는 data-box 로 표시한다', () => {
    const html = '<blockquote data-box="보기"><p>ㄱ. 첫째</p></blockquote>';
    const out = sanitizeProblemHTML(html);
    expect(out).toContain('data-box="보기"');
    expect(out).toContain('ㄱ. 첫째');
  });

  it('허용 목록 밖의 data-box 값은 제거한다 — 인쇄 라벨에 임의 문구가 못 들어오게', () => {
    const out = sanitizeProblemHTML('<blockquote data-box="아무거나">글</blockquote>');
    expect(out).not.toContain('data-box');
    expect(out).toContain('글');
  });

  it('구역 세 종류의 말머리를 모두 통과시킨다', () => {
    for (const label of ['보기 1', '자료', '조건', '마', 'C', 'E']) {
      expect(sanitizeProblemHTML(`<blockquote data-box="${label}">글</blockquote>`))
        .toContain(`data-box="${label}"`);
    }
  });

  it('괄호가 붙은 말머리는 여기서 걸린다 — 다듬기는 파서(normalizeBoxAttributes) 몫이다', () => {
    expect(sanitizeProblemHTML('<blockquote data-box="(가)">글</blockquote>'))
      .not.toContain('data-box');
  });

  it('줄바꿈·구분선·빈 문단을 유지한다 — 원문의 빈 줄이 이 모양으로 저장된다', () => {
    const html = '<p>첫 행<br>둘째 행</p><p></p><hr>';
    expect(sanitizeProblemHTML(html)).toBe(html);
  });

  it('img 를 허용하지 않는다 — 이미지는 저장 경로에서 React 가 그린다', () => {
    const out = sanitizeProblemHTML('<p>그림<img src="https://x/y.png" alt="a"></p>');
    expect(out).not.toContain('<img');
    expect(out).toContain('그림');
  });

  it('script·이벤트 핸들러·javascript: 를 제거한다', () => {
    expect(sanitizeProblemHTML('<script>alert(1)</script><p>본문</p>')).not.toContain('script');
    expect(sanitizeProblemHTML('<p onclick="alert(1)">본문</p>')).not.toContain('onclick');
  });

  it('class 를 허용하지 않는다 — Tailwind overlay 주입 차단', () => {
    const out = sanitizeProblemHTML('<p class="fixed inset-0 z-50">덮개</p>');
    expect(out).not.toContain('class');
  });

  it('개념지 전용 data-concept 은 문항에 들어오지 못한다', () => {
    const out = sanitizeProblemHTML('<p><mark data-concept>개념어</mark></p>');
    expect(out).not.toContain('data-concept');
    expect(out).toContain('개념어');
  });

  it('style 은 좁은 화이트리스트만 통과한다', () => {
    expect(sanitizeProblemHTML('<p style="text-align: center">가운데</p>'))
      .toContain('text-align: center');
    expect(sanitizeProblemHTML('<p style="position: fixed; inset: 0">덮개</p>'))
      .not.toContain('position');
  });

  it('빈 입력은 빈 문자열', () => {
    expect(sanitizeProblemHTML('')).toBe('');
  });
});

describe('sanitizeInlineHTML', () => {
  it('선지에서 블록 태그를 벗겨 낸다 — 한 칸 레이아웃 보호', () => {
    const out = sanitizeInlineHTML('<p>①이 아닌 <strong>본문</strong></p>');
    expect(out).not.toContain('<p>');
    expect(out).toContain('<strong>본문</strong>');
  });

  it('표도 벗겨 낸다(내용은 남는다)', () => {
    const out = sanitizeInlineHTML('<table><tbody><tr><td>가</td></tr></tbody></table>');
    expect(out).not.toContain('<table');
    expect(out).toContain('가');
  });
});

describe('프로필 격리', () => {
  it('문항 정화 뒤에도 개념지 규칙이 그대로다 — 훅이 하나뿐이라 섞이기 쉬운 지점', () => {
    sanitizeProblemHTML('<blockquote data-box="보기">가</blockquote>');
    const concept = sanitizeConceptHTML('<p><mark data-concept>개념어</mark></p>');
    expect(concept).toContain('data-concept');
  });

  it('개념지 정화 뒤에도 문항 규칙이 그대로다', () => {
    sanitizeConceptHTML('<p><mark data-concept>개념어</mark></p>');
    const problem = sanitizeProblemHTML('<blockquote data-box="보기">가</blockquote>');
    expect(problem).toContain('data-box="보기"');
  });

  it('개념지의 data-concept 는 문항 정화에서 계속 막힌다(호출 순서 무관)', () => {
    sanitizeConceptHTML('<p><mark data-concept>ㄱ</mark></p>');
    expect(sanitizeProblemHTML('<p><span data-concept>ㄴ</span></p>')).not.toContain('data-concept');
  });
});

describe('그림 자리표시자', () => {
  it('빈 <figure data-figure> 는 통과한다 — 그림이 본문 어디 있었는지를 남긴다', () => {
    const html = sanitizeProblemHTML('<p>앞</p><figure data-figure="1"></figure><p>뒤</p>');
    expect(html).toContain('data-figure="1"');
    expect(html).toContain('<figure');
  });

  it('한 자리 숫자가 아니면 속성을 지운다', () => {
    expect(sanitizeProblemHTML('<figure data-figure="12"></figure>')).not.toContain('data-figure');
    expect(sanitizeProblemHTML('<figure data-figure="x"></figure>')).not.toContain('data-figure');
    expect(sanitizeProblemHTML('<figure data-figure="0"></figure>')).not.toContain('data-figure');
  });

  it('<img> 는 여전히 막는다 — 서명 URL 은 만료돼 본문에 굳힐 수 없다', () => {
    expect(sanitizeProblemHTML('<figure><img src="https://x/y.jpg"></figure>')).not.toContain('img');
  });

  it('figcaption 은 허용 목록 밖이다', () => {
    const html = sanitizeProblemHTML('<figure data-figure="1"><figcaption>설명</figcaption></figure>');
    expect(html).not.toContain('figcaption');
  });

  it('선지에는 자리표시자를 넣지 않는다 — 한 칸 안에 들어가야 한다', () => {
    expect(sanitizeInlineHTML('<figure data-figure="1"></figure>가')).not.toContain('figure');
  });
});
