import { afterEach, describe, expect, it, vi } from 'vitest';
import { boxPartClassName, splitPassagePieces } from './box-parts';

const htmls = (html: string, figures: string[] = []) =>
  splitPassagePieces(html, figures).map((p) => p.html);
const plain = (html: string) => html.replace(/<[^>]*>/g, '');
const fig = (n: number) => `<figure data-figure="${n}"></figure>`;

describe('splitPassagePieces', () => {
  it('상자 밖 최상위 요소는 예전처럼 하나가 한 조각이다', () => {
    const pieces = splitPassagePieces('<p>a</p><p>b</p>', []);
    expect(pieces.map((p) => p.html)).toEqual(['<p>a</p>', '<p>b</p>']);
    expect(pieces.every((p) => p.box === undefined)).toBe(true);
  });

  it('최상위 구역 상자는 자식마다 한 조각으로 터뜨리고 말머리를 실어 보낸다', () => {
    const pieces = splitPassagePieces(
      '<blockquote data-box="가"><p>1</p><p>2</p><p>3</p></blockquote>', [],
    );
    expect(pieces.map((p) => p.html)).toEqual(['<p>1</p>', '<p>2</p>', '<p>3</p>']);
    expect(pieces.map((p) => p.box)).toEqual([
      { label: '가', first: true, last: false },
      { label: '가', first: false, last: false },
      { label: '가', first: false, last: true },
    ]);
  });

  it('상자가 여럿이면 상자마다 처음·끝을 따로 매긴다', () => {
    const pieces = splitPassagePieces(
      '<blockquote data-box="가"><p>a</p><p>b</p></blockquote>'
      + '<blockquote data-box="나"><p>c</p><p>d</p></blockquote>', [],
    );
    expect(pieces.map((p) => [p.box?.label, p.box?.first, p.box?.last])).toEqual([
      ['가', true, false], ['가', false, true], ['나', true, false], ['나', false, true],
    ]);
  });

  it('원본 (가) 글자가 있는 지문도 글자를 유지하며 구역별로 나눈다', () => {
    const pieces = splitPassagePieces(
      '<blockquote data-box="가"><p>(가) 첫 문단</p><p>이어지는 문단</p></blockquote>'
      + '<blockquote data-box="나"><p>(나) 다음 문단</p></blockquote>', [],
    );
    expect(pieces.map((piece) => piece.html)).toEqual([
      '<p>(가) 첫 문단</p>', '<p>이어지는 문단</p>', '<p>(나) 다음 문단</p>',
    ]);
    expect(pieces.map((piece) => piece.box)).toEqual([
      { label: '가', first: true, last: false },
      { label: '가', first: false, last: true },
      { label: '나', first: true, last: true },
    ]);
  });

  it('자식이 하나뿐인 상자는 그 조각이 처음이자 끝이다', () => {
    const [piece] = splitPassagePieces('<blockquote data-box="보기"><p>x</p></blockquote>', []);
    expect(piece.box).toEqual({ label: '보기', first: true, last: true });
  });

  it('상자 안 가장자리 빈 문단은 걷어내고 가운데 빈 줄은 남긴다', () => {
    const pieces = splitPassagePieces(
      '<blockquote data-box="보기"><p></p><p>가</p><p></p><p>나</p><p><br></p></blockquote>', [],
    );
    expect(pieces.map((p) => p.html)).toEqual(['<p>가</p>', '<p></p>', '<p>나</p>']);
    expect(pieces[0].box?.first).toBe(true);
    expect(pieces[2].box?.last).toBe(true);
  });

  it('빈 문단뿐인 상자는 통째로 둔다 — 터뜨려 비우면 〈보기〉 말머리까지 사라진다', () => {
    const html = '<blockquote data-box="보기"><p></p></blockquote>';
    const pieces = splitPassagePieces(html, []);
    expect(pieces).toEqual([{ html }]);
  });

  it('상자 안 상자는 더 터뜨리지 않는다 — 바깥 상자의 조각 하나로 통째로 간다', () => {
    const inner = '<blockquote data-box="보기"><p>x</p><p>y</p></blockquote>';
    const pieces = splitPassagePieces(`<blockquote data-box="가"><p>a</p>${inner}</blockquote>`, []);
    expect(pieces.map((p) => p.html)).toEqual(['<p>a</p>', inner]);
    expect(pieces[1].box).toEqual({ label: '가', first: false, last: true });
  });

  it('그림만인 자식은 경로를 실은 그림 조각이 되고 상자 표시를 이어 받는다', () => {
    const pieces = splitPassagePieces(
      `<blockquote data-box="보기"><p>앞</p>${fig(1)}<p>뒤</p></blockquote>`, ['g.jpg'],
    );
    expect(pieces[1]).toMatchObject({ figurePath: 'g.jpg', box: { label: '보기', first: false, last: false } });
    expect(pieces[0].box?.first).toBe(true);
    expect(pieces[2].box?.last).toBe(true);
  });

  it('경로 없는 그림은 버린 **뒤에** 빈 문단을 걷는다 — 상자 머리가 한 줄 뜨지 않게', () => {
    const pieces = splitPassagePieces(
      `<blockquote data-box="가">${fig(1)}<p></p><p>글</p></blockquote>`, [''],
    );
    expect(pieces.map((p) => p.html)).toEqual(['<p>글</p>']);
    expect(pieces[0].box).toEqual({ label: '가', first: true, last: true });
  });

  it('상자 밖 그림 조각도 같은 규칙이다', () => {
    expect(splitPassagePieces(`<p>글</p>${fig(1)}`, ['g.jpg'])[1])
      .toEqual({ html: fig(1), figurePath: 'g.jpg' });
    expect(htmls(`<p>글</p>${fig(1)}`, [''])).toEqual(['<p>글</p>']);
  });

  it('상자 안 날글자·줄 안 요소는 한 문단으로 묶는다 — 조용히 잃지 않는다', () => {
    expect(htmls('<blockquote data-box="A">앞 글<strong>굵게</strong><br>뒷 글<p>문단</p>\n</blockquote>'))
      .toEqual(['<p>앞 글<strong>굵게</strong><br>뒷 글</p>', '<p>문단</p>']);
  });

  it('요소 사이 공백은 조각이 아니다', () => {
    expect(htmls('<blockquote data-box="가">\n  <p>a</p>\n  <p>b</p>\n</blockquote>'))
      .toEqual(['<p>a</p>', '<p>b</p>']);
  });

  it('말머리 없는 실제 상자도 문단마다 나누되 테두리만 이어서 그리도록 표시한다', () => {
    const bare = '<blockquote><p>a</p><p>b</p></blockquote>';
    expect(splitPassagePieces(bare, [])).toEqual([
      { html: '<p>a</p>', box: { label: null, first: true, last: false } },
      { html: '<p>b</p>', box: { label: null, first: false, last: true } },
    ]);
  });

  it('허용 목록 밖 말머리는 터뜨리지 않는다', () => {
    const odd = '<blockquote data-box="활동지"><p>a</p><p>b</p></blockquote>';
    expect(splitPassagePieces(odd, [])).toEqual([{ html: odd }]);
  });

  it('다른 속성이 붙은 상자는 통째로 둔다 — 틀을 다시 두르면 그 속성이 사라진다', () => {
    const styled = '<blockquote data-box="가" style="text-align: center"><p>a</p><p>b</p></blockquote>';
    expect(splitPassagePieces(styled, [])).toEqual([{ html: styled }]);
  });

  it('지문 앞뒤의 빈 문단은 상자 밖에서도 걷어낸다', () => {
    expect(htmls('<p></p><blockquote data-box="가"><p>a</p></blockquote><p></p>')).toEqual(['<p>a</p>']);
  });

  it('3,000자를 넘는 (가) 상자도 어느 조각도 길지 않다 — 통째로면 한 쪽을 넘겨 축소된다', () => {
    const paragraphs = Array.from({ length: 60 }, (_, i) => `<p>${`${i}번 문단 `.repeat(8)}</p>`).join('');
    const pieces = splitPassagePieces(`<blockquote data-box="가">${paragraphs}</blockquote>`, []);
    expect(plain(paragraphs).length).toBeGreaterThan(3000);
    expect(pieces).toHaveLength(60);
    expect(Math.max(...pieces.map((p) => plain(p.html).length))).toBeLessThan(400);
  });

  describe('브라우저가 없으면', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('통째로 한 조각이다 — 클라이언트가 다시 계산한다', () => {
      vi.stubGlobal('document', undefined);
      const html = '<blockquote data-box="가"><p>a</p><p>b</p></blockquote>';
      expect(splitPassagePieces(html, [])).toEqual([{ html }]);
      expect(splitPassagePieces('  ', [])).toEqual([]);
    });
  });
});

describe('boxPartClassName', () => {
  it('처음·끝 표시가 클래스로 나온다', () => {
    expect(boxPartClassName({ label: '가', first: true, last: false })).toBe('pb-box-part pb-box-part--first');
    expect(boxPartClassName({ label: '가', first: false, last: false })).toBe('pb-box-part');
    expect(boxPartClassName({ label: '가', first: true, last: true }))
      .toBe('pb-box-part pb-box-part--first pb-box-part--last');
  });
});
