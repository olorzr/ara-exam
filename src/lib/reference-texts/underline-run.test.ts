import { describe, expect, it } from 'vitest';
import { edgeIsLine, isLinedText, isVocabNote, underlineRun } from './underline-run';

/** `data-t` 구절의 밑줄 줄 — [처음 글자, 끝 글자] */
function run(html: string): [string, string] | null {
  const host = document.createElement('p');
  host.innerHTML = html;
  const found = underlineRun(host.querySelector('[data-t]')!);
  return found && [found.first.data, found.last.data];
}

const NOTE = '<span data-t data-note="가"><u>갑</u></span>';
const VOCAB = (extra = '') => `<span${extra} data-note="뜻" data-note-kind="vocab"><u>배채</u></span>`;

describe('underlineRun', () => {
  it('밑줄이 안 이어지면 구절뿐이다', () => {
    expect(run(`앞 ${NOTE} 뒤`)).toEqual(['갑', '갑']);
  });

  it('양옆 밑줄까지 넓힌다', () => {
    expect(run(`맨 글자 <u>앞 </u>${NOTE}<u> 뒤</u> 맨 글자`)).toEqual(['앞 ', ' 뒤']);
  });

  it('⚠️ 밑줄 사이 맨 공백은 틈이다 — 화면에서 줄이 끊긴다', () => {
    expect(run(`<u>앞</u> ${NOTE} <u>뒤</u>`)).toEqual(['갑', '갑']);
  });

  it('긴 줄 안 낱말 뜻풀이와 빈 밑줄을 지나 이어진다', () => {
    expect(run(`${NOTE}<u> </u>${VOCAB(' class="ref-vocab-in-line"')}<u>를</u>`)?.[1]).toBe('를');
  });

  it('⚠️ 화면이 밑줄을 지운 낱말 뜻풀이에서 멈춘다 — 저장된 `<u>` 가 있어도 안 보인다', () => {
    expect(run(`${NOTE}${VOCAB()}<u>를</u>`)?.[1]).toBe('갑');
  });

  it('⚠️ 화면이 밑줄을 긋는 긴 줄 안 낱말은 `<u>` 가 없어도 줄이다', () => {
    expect(run(`${NOTE}<span class="ref-vocab-in-line" data-note="뜻" data-note-kind="vocab">배채</span><u>를</u>`)?.[1]).toBe('를');
  });

  it('⚠️ 서식 안의 맨 글자 틈에서 멈춘다 — 양 끝만 밑줄이어도 줄이 아니다', () => {
    expect(run(`${NOTE}<strong><u>B</u>맨 글자<u>C</u></strong><u>D</u>`)?.[1]).toBe('B');
  });

  it('서식에 겹겹이 싸인 밑줄도 이어진다', () => {
    expect(run(`${NOTE}<strong><u>B</u><em><u>C</u></em>맨 글자</strong>`)?.[1]).toBe('C');
    expect(run(`<strong>맨 <u>앞</u></strong>${NOTE}`)?.[0]).toBe('앞');
  });

  it('⚠️ 다른 구절 해설에서 멈춘다 — 한 문장에 풀이가 둘이면 제 몫만 본다', () => {
    expect(run(`${NOTE}<u> 사이 </u><span data-note="나"><u>을</u></span><u> 끝</u>`)?.[1]).toBe(' 사이 ');
  });

  it('줄바꿈에서 멈춘다 — 시의 다음 행은 다른 줄이다', () => {
    expect(run(`${NOTE}<br><u>다음 행</u>`)?.[1]).toBe('갑');
  });

  it('⚠️ 재는 동안 넣은 받침은 지나간다 — 다시 잴 때 기준 줄이 바뀌면 안 된다', () => {
    expect(run(`${NOTE}<u>앞</u><span class="ref-note-strut"></span><u>뒤</u>`)?.[1]).toBe('뒤');
  });

  it('밑줄 없는 구절 해설도 옆 밑줄과 이어진다 — 화면이 그 구절에 밑줄을 긋는다', () => {
    expect(run('<span data-t data-note="가">맨</span><u>뒤</u>')).toEqual(['맨', '뒤']);
  });

  it('⚠️ 앞 블록의 글자로 넘어가지 않는다 — 거꾸로 걸으면 글자를 블록 요소보다 먼저 만난다', () => {
    const host = document.createElement('div');
    host.innerHTML = `<blockquote><p><u>앞 문단</u></p>${NOTE}<u> 뒤</u></blockquote>`;
    const found = underlineRun(host.querySelector('[data-t]')!);
    expect([found?.first.data, found?.last.data]).toEqual(['갑', ' 뒤']);
  });

  it('⚠️ 구절 끝 글자에 밑줄이 없으면 그쪽으로 안 넓힌다 — 구절 안 앞 공백도 틈이다', () => {
    expect(run('<u>앞</u><span data-t data-note="가"> <u>뒤</u></span><u>끝</u>')).toEqual([' ', '끝']);
    expect(run('<u>앞</u><span data-t data-note="가"><u>뒤</u> </span><u>끝</u>')).toEqual(['앞', ' ']);
  });

  it('글자 없는 구절은 null', () => {
    expect(run('<span data-t data-note="가"></span>')).toBeNull();
  });
});

describe('밑줄 판정', () => {
  const textIn = (html: string) => {
    const host = document.createElement('p');
    host.innerHTML = html;
    return { host, text: host.querySelector('[data-x]')!.firstChild as Text };
  };

  it('화면이 긋는 밑줄만 본다', () => {
    for (const [html, want] of [
      ['<u data-x>가</u>', true],
      ['<b data-x>가</b>', false],
      ['<span data-note="뜻" data-note-kind="vocab"><u data-x>가</u></span>', false],
      ['<u><span data-note="뜻" data-note-kind="vocab"><b data-x>가</b></span></u>', true],
      ['<span class="ref-vocab-in-line" data-note="뜻" data-note-kind="vocab"><b data-x>가</b></span>', true],
      ['<span data-note="해설"><b data-x>가</b></span>', true],
    ] as const) {
      const { host, text } = textIn(html);
      expect(isLinedText(text, host)).toBe(want);
    }
  });

  it('맞닿은 끝을 따라 내려간다', () => {
    const host = document.createElement('p');
    host.innerHTML = '<strong><u>가</u> 나</strong>';
    expect(edgeIsLine(host.firstChild, 'firstChild')).toBe(true);
    expect(edgeIsLine(host.firstChild, 'lastChild')).toBe(false);
    expect(edgeIsLine(null, 'firstChild')).toBe(false);
  });

  it('갈래 값만 홀로 남은 span 은 낱말 뜻풀이가 아니다', () => {
    const host = document.createElement('p');
    host.innerHTML = '<span data-note-kind="vocab">가</span><span data-note="뜻" data-note-kind="vocab">나</span>';
    expect(isVocabNote(host.children[0])).toBe(false);
    expect(isVocabNote(host.children[1])).toBe(true);
  });
});
