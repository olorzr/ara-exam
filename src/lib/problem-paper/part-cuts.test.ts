import { describe, expect, it } from 'vitest';
import { cutCandidatesOf, cutParagraph, isSplittablePartHtml, paragraphOf, partSignature } from './part-cuts';

const para = (html: string) => {
  const p = paragraphOf(html);
  if (!p) throw new Error('문단이 아니다');
  return p;
};
const cut = (html: string, cuts: number[]) => {
  const p = para(html);
  return cutParagraph(p, cutCandidatesOf(p), cuts);
};

describe('cutCandidatesOf', () => {
  it('시는 직계 <br> 마다 한 자리다', () => {
    expect(cutCandidatesOf(para('<p>가<br>나<br>다</p>'))).toEqual([
      { kind: 'br', index: 1 }, { kind: 'br', index: 3 },
    ]);
  });

  it('꾸밈 태그 안에 <br> 이 있으면 줄을 셀 수 없어 자르지 않는다', () => {
    expect(cutCandidatesOf(para('<p>가<u>나<br>다</u><br>라</p>'))).toEqual([]);
  });

  it('<br> 이 있으면 문장 끝은 보지 않는다 — 시 한 행 가운데서 끊지 않는다', () => {
    expect(cutCandidatesOf(para('<p>첫 문장이다. 이어진다<br>다음 행</p>'))).toEqual([{ kind: 'br', index: 1 }]);
  });

  it('산문은 직계 글자 노드의 문장 끝이다', () => {
    expect(cutCandidatesOf(para('<p>첫째다. 둘째요! 셋째인가? 끝</p>')).map((c) => c.kind === 'text' && c.offset))
      .toEqual([4, 9, 15]);
  });

  it('꾸밈 태그 안의 문장 끝에서는 자르지 않는다 — 밑줄 구절은 문항이 가리키는 자리다', () => {
    expect(cutCandidatesOf(para('<p>앞 글 <strong>다. 라</strong> 뒤 글</p>'))).toEqual([]);
  });

  it('숫자 뒤의 점은 문장 끝이 아니다', () => {
    expect(cutCandidatesOf(para('<p>값은 3.5 이고 1. 2 이다</p>'))).toEqual([]);
  });

  it('말줄임표는 문장 끝이 아니다 — 점을 늘어놓아도, 뒤에 점을 찍어도', () => {
    expect(cutCandidatesOf(para('<p>기다렸지만...... 아무 말도 없었다</p>'))).toEqual([]);
    expect(cutCandidatesOf(para('<p>기다렸지만…. 아무 말도 없었다</p>'))).toEqual([]);
    expect(cutCandidatesOf(para('<p>끝났다......<u>밑줄</u> 뒤</p>'))).toEqual([]);
  });

  it('물음표와 느낌표가 겹쳐도 문장 끝이다', () => {
    expect(cutCandidatesOf(para('<p>정말?! 그렇다</p>'))).toEqual([{ kind: 'text', index: 0, offset: 4 }]);
  });

  it('닫는 따옴표까지가 문장 끝이다', () => {
    expect(cutCandidatesOf(para('<p>“그렇다.” 하고 말했다</p>'))).toEqual([{ kind: 'text', index: 0, offset: 6 }]);
  });

  it('글자 노드가 문장 끝으로 끝나고 꾸밈 태그가 이어지면 그 앞이 자리다', () => {
    expect(cutCandidatesOf(para('<p>끝났다.<u>밑줄</u> 뒤</p>'))).toEqual([{ kind: 'text', index: 0, offset: 4 }]);
  });

  it('맨 끝 문장은 자리가 아니다', () => {
    expect(cutCandidatesOf(para('<p>한 문장이다.</p>'))).toEqual([]);
  });
});

describe('cutParagraph', () => {
  it('<br> 자리는 그 <br> 을 버리고 양쪽 조각이 문단이 된다', () => {
    expect(cut('<p>가<br>나<br>다</p>', [0])).toEqual(['<p>가</p>', '<p>나<br>다</p>']);
  });

  it('여러 곳을 한 번에 자른다', () => {
    expect(cut('<p>가<br>나<br>다<br>라</p>', [0, 2])).toEqual(['<p>가</p>', '<p>나<br>다</p>', '<p>라</p>']);
  });

  it('문단의 class·style 과 꾸밈 태그를 조각마다 지킨다', () => {
    expect(cut('<p class="pb-note" style="text-align: right">㉠<u>가</u><br>나</p>', [0])).toEqual([
      '<p class="pb-note" style="text-align: right">㉠<u>가</u></p>',
      '<p class="pb-note" style="text-align: right">나</p>',
    ]);
  });

  it('산문은 문장 끝에서 갈라 뒤 조각의 앞 공백을 지운다', () => {
    expect(cut('<p>첫째다. 둘째다. 셋째</p>', [0])).toEqual(['<p>첫째다.</p>', '<p>둘째다. 셋째</p>']);
  });

  it('같은 글자 노드를 두 번 자른다', () => {
    expect(cut('<p>첫째다. 둘째다. 셋째</p>', [0, 1])).toEqual(['<p>첫째다.</p>', '<p>둘째다.</p>', '<p>셋째</p>']);
  });

  it('빈 줄 옆에서 잘라도 단 머리에 빈 줄을 남기지 않는다', () => {
    expect(cut('<p>가<br><br>나</p>', [0])).toEqual(['<p>가</p>', '<p>나</p>']);
  });

  it('NBSP 들여쓰기는 남긴다', () => {
    expect(cut('<p>가<br>&nbsp;&nbsp;나</p>', [0])[1]).toBe('<p>&nbsp;&nbsp;나</p>');
  });

  it('NBSP 만 있는 글자 노드도 남긴다 — 꾸밈 태그 앞의 들여쓰기가 사라지면 안 된다', () => {
    expect(cut('<p>가<br>&nbsp;&nbsp;<u>나</u></p>', [0])[1]).toBe('<p>&nbsp;&nbsp;<u>나</u></p>');
    expect(cut('<p>&nbsp;&nbsp;<u>가</u><br>나</p>', [0])[0]).toBe('<p>&nbsp;&nbsp;<u>가</u></p>');
  });

  it('비어 버린 조각은 내지 않는다', () => {
    expect(cut('<p>가<br><br></p>', [0])).toEqual(['<p>가</p>']);
  });

  it('글자를 잃지 않는다', () => {
    const html = '<p>첫째다. <u>밑줄</u> 둘째다. 셋째다. 넷째</p>';
    const plain = (s: string) => s.replace(/<[^>]*>|\s/g, '');
    const p = para(html);
    const all = cutCandidatesOf(p).map((_, i) => i);
    expect(plain(cutParagraph(p, cutCandidatesOf(p), all).join(''))).toBe(plain(html));
  });
});

describe('isSplittablePartHtml', () => {
  it('문단 하나이고 자리가 있어야 한다', () => {
    expect(isSplittablePartHtml('<p>가<br>나</p>')).toBe(true);
    expect(isSplittablePartHtml('<p>첫째다. 둘째</p>')).toBe(true);
    expect(isSplittablePartHtml('<p>가</p>')).toBe(false);
  });

  it('문단이 아니거나 둘이면 아니다', () => {
    expect(isSplittablePartHtml('<p>가<br>나</p><p>다</p>')).toBe(false);
    expect(isSplittablePartHtml('<table><tr><td>가<br>나</td></tr></table>')).toBe(false);
    expect(isSplittablePartHtml('<blockquote data-box="보기"><p>가<br>나</p></blockquote>')).toBe(false);
    expect(isSplittablePartHtml('<figure data-figure="1"></figure>')).toBe(false);
  });

  it('문단 뒤에 날글자가 붙으면 아니다 — 잘라서 잃으면 안 된다', () => {
    expect(paragraphOf('<p>가<br>나</p>뒤 글')).toBeNull();
  });
});

describe('partSignature', () => {
  it('자리 수와 글자 수로 같은 문단인지 가른다', () => {
    expect(partSignature(para('<p>가<br>나</p>'))).toBe(partSignature(para('<p class="pb-note">가<br>나</p>')));
    expect(partSignature(para('<p>가<br>나</p>'))).not.toBe(partSignature(para('<p>가<br>나<br>다</p>')));
  });
});
