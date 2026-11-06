import { describe, expect, it } from 'vitest';
import { isBlankText, markBlanks } from './blanks';

const SP = '　';

describe('isBlankText', () => {
  it.each([
    ['공백만', `${SP}${SP}${SP}`],
    ['표시 글자 하나', `${SP}${SP}㉠${SP}${SP}`],
    ['따옴표로 감싼 표시', `“${SP}${SP}㉠${SP}${SP}”`],
  ])('%s 는 빈칸이다', (_, text) => {
    expect(isBlankText(text)).toBe(true);
  });

  it.each([
    ['전각 공백이 없는 글', '밑줄 글'],
    ['보통 공백뿐인 글', '   '],
    ['전각 공백이 섞인 낱말', `뉴스${SP}광고`],
  ])('%s 는 빈칸이 아니다', (_, text) => {
    expect(isBlankText(text)).toBe(false);
  });
});

describe('markBlanks', () => {
  it('밑줄·네모 빈칸에 표시를 붙인다', () => {
    expect(markBlanks(`<p>말 <u>${SP}${SP}</u> 과 <code>${SP}ⓐ${SP}</code></p>`))
      .toBe(`<p>말 <u class="pb-blank">${SP}${SP}</u> 과 <code class="pb-blank">${SP}ⓐ${SP}</code></p>`);
  });

  it('밑줄 글은 건드리지 않는다 — 멀쩡한 글의 줄바꿈이 바뀐다', () => {
    const html = `<p><u>양성 모음끼리</u> <u>${SP}${SP}</u></p>`;
    expect(markBlanks(html)).toBe(`<p><u>양성 모음끼리</u> <u class="pb-blank">${SP}${SP}</u></p>`);
  });

  it.each([
    ['빈칸이 없는 글', '<p>글</p>'],
    ['전각 공백이 든 밑줄 글', `<p><u>뉴스${SP}광고</u></p>`],
    ['빈 글', ''],
  ])('%s 은 들어온 글자 그대로다', (_, html) => {
    expect(markBlanks(html)).toBe(html);
  });

  it('두 번 돌려도 같다', () => {
    const once = markBlanks(`<p><u>${SP}${SP}</u></p>`);
    expect(markBlanks(once)).toBe(once);
  });
});
