import { describe, it, expect } from 'vitest';
import { sanitizeConceptHTML } from './sanitize-html';

describe('sanitizeConceptHTML', () => {
  it('<script> 태그를 제거한다', () => {
    const out = sanitizeConceptHTML('<p>안녕</p><script>alert(1)</script>');
    expect(out).not.toContain('<script');
    expect(out).toContain('<p>안녕</p>');
  });

  it('<img> 의 onerror 핸들러와 태그 자체를 제거한다', () => {
    const out = sanitizeConceptHTML('<img src=x onerror="fetch(\'/steal\')">');
    expect(out).not.toContain('onerror');
    expect(out).not.toContain('<img');
  });

  it('javascript: 스킴을 제거한다', () => {
    const out = sanitizeConceptHTML('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toContain('javascript:');
  });

  it('<mark data-concept> 은 보존한다', () => {
    const html = '<p>이것은 <mark data-concept="true">개념</mark>이다</p>';
    const out = sanitizeConceptHTML(html);
    expect(out).toContain('<mark');
    expect(out).toContain('data-concept');
    expect(out).toContain('개념');
  });

  it('<table> 셀의 data-bg-color / data-bordertop / background-color style 을 보존한다', () => {
    const html =
      '<table><tbody><tr>' +
      '<td data-bg-color="#FEF3C7" data-bordertop="transparent" style="background-color: #FEF3C7">셀</td>' +
      '</tr></tbody></table>';
    const out = sanitizeConceptHTML(html);
    expect(out).toContain('<table');
    expect(out).toContain('data-bg-color');
    expect(out).toContain('data-bordertop');
    expect(out).toContain('background-color');
  });

  it('text-align inline style 을 보존한다', () => {
    const out = sanitizeConceptHTML('<h3 style="text-align: center">제목</h3>');
    expect(out).toContain('text-align');
    expect(out).toContain('center');
  });

  it('colspan / rowspan 속성을 보존한다', () => {
    const html =
      '<table><tbody><tr><td colspan="2" rowspan="3">병합</td></tr></tbody></table>';
    const out = sanitizeConceptHTML(html);
    expect(out).toContain('colspan="2"');
    expect(out).toContain('rowspan="3"');
  });

  it('h3 / h4 / ul / li / strong / em / u 등 TipTap 기본 태그를 보존한다', () => {
    const html =
      '<h3>h3</h3><h4>h4</h4>' +
      '<ul><li><strong>s</strong> <em>e</em> <u>u</u></li></ul>';
    const out = sanitizeConceptHTML(html);
    expect(out).toContain('<h3>');
    expect(out).toContain('<h4>');
    expect(out).toContain('<ul>');
    expect(out).toContain('<li>');
    expect(out).toContain('<strong>');
    expect(out).toContain('<em>');
    expect(out).toContain('<u>');
  });

  it('<iframe> / <object> / <embed> 를 제거한다', () => {
    const out = sanitizeConceptHTML(
      '<iframe src="//evil"></iframe><object></object><embed>',
    );
    expect(out).not.toContain('<iframe');
    expect(out).not.toContain('<object');
    expect(out).not.toContain('<embed');
  });

  it('전체화면 overlay CSS(position/inset)를 제거한다', () => {
    const out = sanitizeConceptHTML(
      '<p style="position:fixed;inset:0;z-index:9999">overlay</p>',
    );
    expect(out).not.toContain('position');
    expect(out).not.toContain('inset');
    expect(out).not.toContain('z-index');
    expect(out).toContain('overlay');
  });

  it('background-image:url(...) 주입을 제거한다', () => {
    const out = sanitizeConceptHTML(
      '<p style="background-image:url(javascript:alert(1))">x</p>',
    );
    expect(out).not.toContain('url(');
    expect(out).not.toContain('javascript');
    expect(out).not.toContain('background-image');
  });

  it('화이트리스트 밖 CSS 만 있으면 style 속성을 통째로 제거한다', () => {
    const out = sanitizeConceptHTML('<p style="display:none;width:9999px">x</p>');
    expect(out).not.toContain('style');
    expect(out).not.toContain('display');
    expect(out).not.toContain('width');
  });

  it('허용 색상은 남기고 위험 속성은 제거한다(혼합 선언)', () => {
    const out = sanitizeConceptHTML(
      '<table><tbody><tr>' +
        '<td style="background-color:#FEF3C7;position:fixed">셀</td>' +
        '</tr></tbody></table>',
    );
    expect(out).toContain('background-color');
    expect(out).toContain('#FEF3C7');
    expect(out).not.toContain('position');
  });

  it('text-align 의 비정상 값(url 등)을 제거한다', () => {
    const out = sanitizeConceptHTML(
      '<h3 style="text-align:url(x)">제목</h3>',
    );
    expect(out).not.toContain('url(');
    // 허용 키워드가 아니므로 text-align 자체가 제거된다
    expect(out).not.toContain('text-align');
    expect(out).toContain('제목');
  });

  it('class 속성을 제거한다(Tailwind 유틸리티 기반 UI 주입 차단)', () => {
    const out = sanitizeConceptHTML(
      '<p class="fixed inset-0 z-50 bg-black">overlay</p>',
    );
    expect(out).not.toContain('class');
    expect(out).not.toContain('fixed');
    expect(out).toContain('overlay');
  });

  it('화이트리스트 밖 임의 data-* 속성을 제거한다', () => {
    const out = sanitizeConceptHTML(
      '<p data-evil="x" data-controller="hack">텍스트</p>',
    );
    expect(out).not.toContain('data-evil');
    expect(out).not.toContain('data-controller');
    expect(out).toContain('텍스트');
  });

  it('빈 문자열을 입력하면 빈 문자열을 반환한다', () => {
    expect(sanitizeConceptHTML('')).toBe('');
  });
});
