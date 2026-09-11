import { describe, it, expect } from 'vitest';
import { renderFiguresInHtml, soleFigureIndex, unplacedFigures } from './figure-render';

const fig = (n: number) => `<figure data-figure="${n}"></figure>`;
const urls = new Map([['a.jpg', 'https://x/a?token=1&k=2']]);

describe('renderFiguresInHtml', () => {
  it('자리표시자 자리에 이미지를 넣는다', () => {
    const html = renderFiguresInHtml(`<p>앞</p>${fig(1)}<p>뒤</p>`, ['a.jpg'], urls);
    expect(html).toContain('<p>앞</p>');
    expect(html).toContain('<img');
    expect(html).toContain('<p>뒤</p>');
  });

  it('⚠️ 상자 안의 그림도 **상자 안에** 남는다 — 잘라 나누면 상자가 먼저 닫힌다', () => {
    const html = renderFiguresInHtml(
      `<blockquote data-box="보기"><p>글</p>${fig(1)}<p>뒷글</p></blockquote>`,
      ['a.jpg'], urls,
    );
    // 여는 태그·닫는 태그가 갈리지 않았다
    expect(html.startsWith('<blockquote data-box="보기">')).toBe(true);
    expect(html.endsWith('</blockquote>')).toBe(true);
    expect(html.indexOf('<img')).toBeGreaterThan(html.indexOf('<blockquote'));
    expect(html.indexOf('<img')).toBeLessThan(html.indexOf('</blockquote>'));
  });

  it('표 칸 안의 그림도 칸 안에 남는다', () => {
    const html = renderFiguresInHtml(
      `<table><tbody><tr><td>${fig(1)}</td></tr></tbody></table>`, ['a.jpg'], urls,
    );
    expect(html).toContain('<td><img');
  });

  it('서명 URL 의 & 와 따옴표를 escape 한다', () => {
    const html = renderFiguresInHtml(fig(1), ['a.jpg'], urls);
    expect(html).toContain('token=1&amp;k=2');
    expect(html).not.toContain('token=1&k=2');
  });

  it('URL 이 없으면 눈에 보이는 자리를 남긴다 — 조용히 비우면 원래 없었는지 알 수 없다', () => {
    const html = renderFiguresInHtml(fig(1), ['a.jpg'], new Map());
    expect(html).toContain('불러오지 못했어요');
  });

  it('자리표시자가 없으면 그대로 둔다', () => {
    expect(renderFiguresInHtml('<p>글</p>', [], urls)).toBe('<p>글</p>');
  });
});

describe('soleFigureIndex', () => {
  it('그림 하나뿐인 조각을 알아본다', () => {
    expect(soleFigureIndex(fig(2))).toBe(2);
  });

  it('글이 섞여 있으면 null — 그 조각은 통째로 그려야 한다', () => {
    expect(soleFigureIndex(`<p>글</p>${fig(1)}`)).toBeNull();
    expect(soleFigureIndex('<blockquote data-box="보기">' + fig(1) + '</blockquote>')).toBeNull();
  });

  it('그림이 없으면 null', () => {
    expect(soleFigureIndex('<p>글</p>')).toBeNull();
  });
});

describe('unplacedFigures', () => {
  it('자리표시자가 없는 그림만 고른다', () => {
    expect(unplacedFigures(fig(1), ['a.jpg', 'b.jpg'])).toEqual([{ index: 2, path: 'b.jpg' }]);
  });

  it('못 만든 빈 경로는 빼놓는다', () => {
    expect(unplacedFigures('<p>글</p>', ['', 'b.jpg'])).toEqual([{ index: 2, path: 'b.jpg' }]);
  });

  it('다 자리를 잡았으면 빈 배열', () => {
    expect(unplacedFigures(`${fig(1)}${fig(2)}`, ['a.jpg', 'b.jpg'])).toEqual([]);
  });
});
