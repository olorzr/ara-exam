import { describe, expect, it } from 'vitest';
import { markFootnotes } from '@/lib/problem-bank/footnotes';
import { appendVocabList } from './vocab-list';

/** 목록을 읽는다 — [낱말, 뜻] 줄 */
function entries(html: string): [string, string][] {
  const host = document.createElement('div');
  host.innerHTML = html;
  return Array.from(host.querySelectorAll('.ref-vocab li')).map((li) => [
    li.querySelector('.ref-vocab__word')!.textContent!,
    li.querySelector('.ref-vocab__meaning')!.textContent!,
  ]);
}

const vocab = (word: string, meaning: string) => `<span data-note="${meaning}" data-note-kind="vocab">${word}</span>`;

describe('appendVocabList', () => {
  it('낱말 뜻풀이를 글 차례대로 모아 본문 맨 끝에 붙인다', () => {
    const out = appendVocabList(`<p>${vocab('수탉', '닭의 수컷')}이</p><p>${vocab('횃소리', '날갯짓 소리')}를</p>`);
    expect(entries(out)).toEqual([['수탉', '닭의 수컷'], ['횃소리', '날갯짓 소리']]);
    expect(out.endsWith('</section>')).toBe(true);
    expect(out.startsWith('<p>')).toBe(true);
  });

  it('구절 해설은 모으지 않는다', () => {
    const out = appendVocabList(`<p>${vocab('수탉', '닭의 수컷')} <span data-note="화가 남">운다</span></p>`);
    expect(entries(out)).toEqual([['수탉', '닭의 수컷']]);
  });

  it('⚠️ 어휘가 없으면 들어온 글자 그대로다 — 다시 직렬화한 글이 미세하게 달라질 여지를 없앤다', () => {
    for (const html of ['', '<p>가&nbsp;나</p>', '<p><span data-note="해설">가</span></p>']) expect(appendVocabList(html)).toBe(html);
  });

  it('⚠️ 풀이 없이 홀로 남은 갈래 값은 어휘가 아니다', () => {
    const html = '<p><span data-note-kind="vocab">가</span></p>';
    expect(appendVocabList(html)).toBe(html);
  });

  it('낱말과 뜻이 같으면 한 번만, 뜻이 다르면 둘 다', () => {
    const out = appendVocabList(`<p>${vocab('마름', '땅 관리인')} ${vocab('마름', '땅 관리인')} ${vocab('마름', '물풀')}</p>`);
    expect(entries(out)).toEqual([['마름', '땅 관리인'], ['마름', '물풀']]);
  });

  it('서식이 든 낱말은 글자만, 공백은 접어서', () => {
    const out = appendVocabList('<p><span data-note="뜻" data-note-kind="vocab"><u>얼음\n위에</u> <code>박</code></span></p>');
    expect(entries(out)).toEqual([['얼음 위에 박', '뜻']]);
  });

  it('⚠️ 줄바꿈이 든 낱말은 앞뒤가 붙지 않는다 — 줄바꿈은 글자가 없다', () => {
    const out = appendVocabList('<p><span data-note="적극적으로 나서다" data-note-kind="vocab"><u>발 벗고<br>나서다</u></span></p>');
    expect(entries(out)).toEqual([['발 벗고 나서다', '적극적으로 나서다']]);
    expect(out).toContain('발 벗고<br>나서다');
  });

  it('글자가 없는 낱말은 건너뛴다', () => {
    const html = '<p><span data-note="뜻" data-note-kind="vocab"> </span></p>';
    expect(appendVocabList(html)).toBe(html);
  });

  it('⚠️ 낱말과 뜻의 꺾쇠·따옴표·앰퍼샌드는 태그가 되지 않는다', () => {
    const out = appendVocabList('<p><span data-note="&quot;가&quot; &amp; 나" data-note-kind="vocab">&lt;b&gt;낱말</span></p>');
    expect(entries(out)).toEqual([['<b>낱말', '"가" & 나']]);
    const host = document.createElement('div');
    host.innerHTML = out;
    expect(host.querySelector('.ref-vocab li b b')).toBeNull();
  });

  it('⚠️ 긴 밑줄 줄 안의 낱말만 표시한다 — 사이에 맨 글자가 있으면 줄이 아니다', () => {
    const inLine = (html: string) => {
      const host = document.createElement('div');
      host.innerHTML = appendVocabList(html);
      return host.querySelector('span[data-note-kind]')!.classList.contains('ref-vocab-in-line');
    };
    const word = '<span data-note="뜻" data-note-kind="vocab"><u>낱말</u></span>';
    expect(inLine(`<p><u>앞 줄</u>${word}<u>뒤 줄</u></p>`)).toBe(true);
    expect(inLine(`<p><span data-note="해설"><u>앞 줄</u></span>${word}</p>`)).toBe(true);
    expect(inLine(`<p><u>앞 줄</u> 맨 글자 ${word}</p>`)).toBe(false);
    expect(inLine(`<p>${word}<span data-note="다른 뜻" data-note-kind="vocab"><u>옆 낱말</u></span></p>`)).toBe(false);
    expect(inLine(`<p><span data-note="해설">밑줄 없는 구절</span>${word}</p>`)).toBe(false);
    expect(inLine(`<p><u>앞 줄</u><u> </u>${word}</p>`)).toBe(true);
  });

  it('⚠️ 서식에 싸인 밑줄도 줄이다 — 맞닿은 끝 글자로 본다', () => {
    const inLine = (html: string) => {
      const host = document.createElement('div');
      host.innerHTML = appendVocabList(html);
      return host.querySelector('span[data-note-kind]')!.classList.contains('ref-vocab-in-line');
    };
    const word = '<span data-note="뜻" data-note-kind="vocab"><strong><u>낱말</u></strong></span>';
    expect(inLine(`<p><strong><u>앞</u></strong>${word}<strong><u>뒤</u></strong></p>`)).toBe(true);
    expect(inLine(`<p>${word}<strong><u>뒤</u> 맨 글자</strong></p>`)).toBe(true);
    expect(inLine(`<p><strong><u>앞</u> 맨 글자</strong>${word}</p>`)).toBe(false);
    expect(inLine(`<p>${word}<strong>맨 글자 <u>뒤</u></strong></p>`)).toBe(false);
  });

  it('서식에 싸인 빈 밑줄도 낱말 사이에서는 글자로 푼다', () => {
    const a = '<span data-note="가" data-note-kind="vocab"><u>갑</u></span>';
    const b = '<span data-note="나" data-note-kind="vocab"><u>을</u></span>';
    const host = document.createElement('div');
    host.innerHTML = appendVocabList(`<p>${a}<strong><u> </u></strong>${b}</p>`);
    expect(host.querySelector('p strong')).toBeNull();
    expect(host.querySelector('p')!.textContent).toBe('갑 을');
  });

  it('⚠️ 낱말 둘 사이의 빈 밑줄은 줄이 아니다 — 낱말 밑줄이 지워지면 공백 밑줄만 남는다', () => {
    const a = '<span data-note="담배" data-note-kind="vocab"><u>궐련</u></span>';
    const b = '<span data-note="담뱃대" data-note-kind="vocab"><u>물부리</u></span>';
    const host = document.createElement('div');
    host.innerHTML = appendVocabList(`<p>입에다 ${a}<u> </u>${b}를 물렸다</p>`);
    expect(host.querySelector('.ref-vocab-in-line')).toBeNull();
    expect(host.querySelector('p')!.textContent).toBe('입에다 궐련 물부리를 물렸다');
    expect(host.querySelectorAll('p u')).toHaveLength(2);
  });

  it('⚠️ 밑줄 안의 줄바꿈은 풀지 않는다 — 글자는 없어도 풀면 원문의 두 행이 붙는다', () => {
    const a = '<span data-note="가" data-note-kind="vocab"><u>갑</u></span>';
    const b = '<span data-note="나" data-note-kind="vocab"><u>을</u></span>';
    for (const line of ['<u><br></u>', '<strong><u><br></u></strong>']) {
      const host = document.createElement('div');
      host.innerHTML = appendVocabList(`<p>${a}${line}${b}</p>`);
      expect(host.querySelectorAll('p br')).toHaveLength(1);
    }
  });

  it('긴 밑줄 줄 안의 낱말 사이 빈 밑줄은 그대로다 — 줄이 끊기면 안 된다', () => {
    const a = '<span data-note="가" data-note-kind="vocab"><u>갑</u></span>';
    const b = '<span data-note="나" data-note-kind="vocab"><u>을</u></span>';
    const host = document.createElement('div');
    host.innerHTML = appendVocabList(`<p><u>앞 줄 </u>${a}<u> </u>${b} 끝</p>`);
    expect(host.querySelectorAll('.ref-vocab-in-line')).toHaveLength(2);
    expect(host.querySelectorAll('p > u')).toHaveLength(2);
  });

  it('각주 표시를 지난 글에도 붙고 각주는 그대로다', () => {
    const out = appendVocabList(markFootnotes(`<p>${vocab('수탉', '닭의 수컷')}</p><p>*열무: 어린 무.</p>`));
    expect(out).toContain('class="pb-note"');
    expect(entries(out)).toEqual([['수탉', '닭의 수컷']]);
  });
});
