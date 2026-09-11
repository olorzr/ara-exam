import { describe, it, expect } from 'vitest';
import {
  figureNumbersIn, reconcileFigurePlaceholders, removeFigureAt,
  shiftFigurePlaceholders, splitByFigurePlaceholders,
} from './figure-placeholders';

const fig = (n: number) => `<figure data-figure="${n}"></figure>`;

describe('splitByFigurePlaceholders', () => {
  it('자리표시자마다 본문을 가른다 — 그 사이에 이미지를 끼운다', () => {
    const html = `<p>앞</p>${fig(1)}<p>뒤</p>`;
    expect(splitByFigurePlaceholders(html)).toEqual([
      { kind: 'html', html: '<p>앞</p>' },
      { kind: 'figure', index: 1 },
      { kind: 'html', html: '<p>뒤</p>' },
    ]);
  });

  it('자리표시자가 없으면 통째로 한 조각', () => {
    expect(splitByFigurePlaceholders('<p>글</p>')).toEqual([
      { kind: 'html', html: '<p>글</p>' },
    ]);
  });

  it('닫는 태그가 없어도 알아본다 — 편집기가 모양을 바꿀 수 있다', () => {
    expect(figureNumbersIn('<figure data-figure="2" />')).toEqual([2]);
    expect(figureNumbersIn("<figure data-figure='3'>")).toEqual([3]);
  });

  it('다른 속성이 섞여도 알아본다 — 편집기 HTML 은 정화 전에 지역 state 로 들어온다', () => {
    expect(figureNumbersIn('<figure class="pb-figure-slot" data-figure="1"></figure>')).toEqual([1]);
    expect(figureNumbersIn('<figure data-figure="2" class="x" draggable="true"></figure>')).toEqual([2]);
  });

  it('속성이 섞인 자리표시자도 제대로 빼고 번호를 당긴다', () => {
    const html = '<figure class="pb-figure-slot" data-figure="1"></figure>'
      + '<p>글</p><figure class="pb-figure-slot" data-figure="2"></figure>';
    const res = removeFigureAt(html, ['a.jpg', 'b.jpg'], 1);
    expect(res.paths).toEqual(['b.jpg']);
    expect(res.html).toBe(`<p>글</p>${fig(1)}`);
  });

  it('그림만 있는 본문도 다룬다', () => {
    expect(splitByFigurePlaceholders(fig(1))).toEqual([{ kind: 'figure', index: 1 }]);
  });

  it('빈 조각은 버린다 — 빈 <div> 가 인쇄에서 줄을 벌린다', () => {
    expect(splitByFigurePlaceholders(`  ${fig(1)}  `)).toEqual([{ kind: 'figure', index: 1 }]);
  });
});

describe('reconcileFigurePlaceholders', () => {
  it('없는 그림을 가리키는 자리표시자는 지운다', () => {
    expect(reconcileFigurePlaceholders(`<p>글</p>${fig(3)}`, 1)).toBe(`<p>글</p>${fig(1)}`);
  });

  it('자리표시자가 없는 그림은 끝에 붙인다 — 자리를 모르는 것보다 있는 편이 낫다', () => {
    expect(reconcileFigurePlaceholders('<p>글</p>', 2)).toBe(`<p>글</p>${fig(1)}${fig(2)}`);
  });

  it('중복은 하나만 남긴다', () => {
    expect(reconcileFigurePlaceholders(`${fig(1)}<p>글</p>${fig(1)}`, 1))
      .toBe(`${fig(1)}<p>글</p>`);
  });

  it('그림이 없으면 자리표시자를 전부 지운다', () => {
    expect(reconcileFigurePlaceholders(`<p>글</p>${fig(1)}`, 0)).toBe('<p>글</p>');
  });

  it('맞아떨어지면 그대로 둔다', () => {
    const html = `<p>앞</p>${fig(1)}<p>뒤</p>${fig(2)}`;
    expect(reconcileFigurePlaceholders(html, 2)).toBe(html);
  });
});

describe('shiftFigurePlaceholders', () => {
  it('조각을 이어 붙일 때 번호를 민다 — 안 밀면 뒤 조각이 앞 그림을 가리킨다', () => {
    expect(shiftFigurePlaceholders(`<p>뒤</p>${fig(1)}`, 2)).toBe(`<p>뒤</p>${fig(3)}`);
  });

  it('밀 것이 없으면 그대로', () => {
    expect(shiftFigurePlaceholders(`${fig(1)}`, 0)).toBe(fig(1));
  });

  it('상한을 넘는 번호는 지운다 — 가리킬 그림이 없다', () => {
    expect(shiftFigurePlaceholders(`<p>글</p>${fig(5)}`, 8)).toBe('<p>글</p>');
  });
});

describe('removeFigureAt', () => {
  it('자리표시자와 경로를 함께 빼고 뒷번호를 당긴다', () => {
    const html = `${fig(1)}<p>글</p>${fig(2)}${fig(3)}`;
    const res = removeFigureAt(html, ['a.jpg', 'b.jpg', 'c.jpg'], 2);
    expect(res.paths).toEqual(['a.jpg', 'c.jpg']);
    expect(res.html).toBe(`${fig(1)}<p>글</p>${fig(2)}`);
  });

  it('마지막 그림을 빼도 앞은 그대로다', () => {
    const res = removeFigureAt(`${fig(1)}${fig(2)}`, ['a.jpg', 'b.jpg'], 2);
    expect(res.paths).toEqual(['a.jpg']);
    expect(res.html).toBe(fig(1));
  });

  it('본문에 자리표시자가 없어도 경로는 뺀다', () => {
    const res = removeFigureAt('<p>글</p>', ['a.jpg'], 1);
    expect(res.paths).toEqual([]);
    expect(res.html).toBe('<p>글</p>');
  });
});
