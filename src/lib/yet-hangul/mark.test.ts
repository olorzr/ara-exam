import { describe, expect, it } from 'vitest';
import { markFootnotes } from '@/lib/problem-bank/footnotes';
import { markYetHangul, yetHangulClass } from './mark';

/** ᄒᆞᆫ — 첫가끝 자모로 적은 옛한글 한 음절 */
const YET = 'ᄒᆞᆫ';

describe('markYetHangul — 옛 글자가 든 가장 안쪽 블록에만', () => {
  it('옛 글자가 든 문단에만 붙고 현대어 문단은 그대로다', () => {
    expect(markYetHangul(`<p>현대</p><p>${YET}</p>`)).toBe(`<p>현대</p><p class="yet-hangul">${YET}</p>`);
  });

  it('〈보기〉 상자가 아니라 그 안 문단에 붙는다 — 상자 말머리와 옆 문단은 앱 글꼴로 남는다', () => {
    const html = `<blockquote data-box="보기"><p>${YET}</p><p>현대</p></blockquote>`;
    expect(markYetHangul(html)).toBe(`<blockquote data-box="보기"><p class="yet-hangul">${YET}</p><p>현대</p></blockquote>`);
  });

  it.each([
    ['목록', `<ul><li>${YET}</li><li>현대</li></ul>`, `<ul><li class="yet-hangul">${YET}</li><li>현대</li></ul>`],
    ['목록 안 문단', `<ul><li><p>${YET}</p></li></ul>`, `<ul><li><p class="yet-hangul">${YET}</p></li></ul>`],
    ['표 칸', `<table><tbody><tr><td>${YET}</td><td>현대</td></tr></tbody></table>`,
      `<table><tbody><tr><td class="yet-hangul">${YET}</td><td>현대</td></tr></tbody></table>`],
    ['표 머리', `<table><thead><tr><th>${YET}</th></tr></thead></table>`, `<table><thead><tr><th class="yet-hangul">${YET}</th></tr></thead></table>`],
    ['꾸밈 태그 안', `<p>현대 <u>${YET}</u></p>`, `<p class="yet-hangul">현대 <u>${YET}</u></p>`],
  ])('%s', (_, html, expected) => {
    expect(markYetHangul(html)).toBe(expected);
  });

  it('블록 없는 날글자는 그 글자만 span 으로 감싼다 — 그릇에 걸면 상자 전체가 바뀐다', () => {
    expect(markYetHangul(`<blockquote data-box="보기">${YET} 글</blockquote>`))
      .toBe(`<blockquote data-box="보기"><span class="yet-hangul">${YET} 글</span></blockquote>`);
    expect(markYetHangul(`${YET}<p>현대</p>`)).toBe(`<span class="yet-hangul">${YET}</span><p>현대</p>`);
    expect(markYetHangul(`<blockquote><u>${YET}</u></blockquote>`))
      .toBe(`<blockquote><u><span class="yet-hangul">${YET}</span></u></blockquote>`);
  });

  it('두 번 돌려도 같다', () => {
    for (const html of [`<p>${YET}</p>`, `<blockquote>${YET}</blockquote>`, `<p><u>${YET}</u> ${YET}</p>`]) {
      const once = markYetHangul(html);
      expect(markYetHangul(once)).toBe(once);
    }
  });

  it('이미 있는 클래스를 지우지 않는다', () => {
    expect(markYetHangul(`<p class="pb-note">${YET}</p>`)).toBe(`<p class="pb-note yet-hangul">${YET}</p>`);
  });

  it('방점·한양 PUA 도 옛 글자로 본다', () => {
    expect(markYetHangul('<p>나〮랏</p>')).toContain('class="yet-hangul"');
    expect(markYetHangul('<p></p>')).toContain('class="yet-hangul"');
  });

  it.each([
    ['현대 글', '<p>현대 국어</p>'],
    ['자모로 갈린 현대 글(NFD)', `<p>${'한글'.normalize('NFD')}</p>`],
    ['낱자 ㆍ 를 설명하는 글', '<p>ㆍ의 소실에 대한 설명은?</p>'],
    ['빈 글', ''],
  ])('%s 는 들어온 글자 그대로다', (_, html) => {
    expect(markYetHangul(html)).toBe(html);
  });

  it('각주 표시 뒤에 불러야 각주가 새로 만든 문단에도 붙는다 — 차례를 고정한다', () => {
    const html = `<p>시구 ${YET}<br>*${YET}: 풀이</p>`;
    expect(markYetHangul(markFootnotes(html)))
      .toBe(`<p class="yet-hangul">시구 ${YET}</p><p class="pb-note yet-hangul">*${YET}: 풀이</p>`);
    expect(markFootnotes(markYetHangul(html))).not.toContain('pb-note yet-hangul');
  });
});

describe('yetHangulClass', () => {
  it('옛 글자가 있을 때만 클래스를 내준다', () => {
    expect(yetHangulClass(YET)).toBe('yet-hangul');
    expect(yetHangulClass('가')).toBeUndefined();
    expect(yetHangulClass('')).toBeUndefined();
  });
});
