import { describe, expect, it } from 'vitest';
import type { PassagePiece } from './box-parts';
import { LINE_SPLIT_MIN_LINES, lineCutsOf, splitLongLinePieces } from './stem-line-units';

/** 줄 n 개짜리 문단 */
const poem = (n: number, attrs = '') => `<p${attrs}>${Array.from({ length: n }, (_, i) => `줄${i + 1}`).join('<br>')}</p>`;

/** 묶음 HTML 들에서 줄 글자만 — 이어 붙여 원래 줄과 같은지 본다 */
const linesOf = (htmls: readonly string[]) => htmls.flatMap((html) => html.replace(/^<p[^>]*>|<\/p>$/g, '').split('<br>'));

describe('lineCutsOf', () => {
  it('짧은 문단은 자르지 않는다', () => {
    expect(lineCutsOf(Array(LINE_SPLIT_MIN_LINES - 1).fill(false))).toEqual([]);
  });

  it('두 줄씩 묶고 홀수면 마지막 묶음이 세 줄이다', () => {
    // 9줄: 줄 1·2 | 3·4 | 5·6 | 7·8·9 → <br> 1·3·5 뒤
    expect(lineCutsOf(Array(9).fill(false))).toEqual([1, 3, 5]);
    expect(lineCutsOf(Array(6).fill(false))).toEqual([1, 3]);
  });

  it('빈 줄 옆에서는 자르지 않는다 — 연 사이 빈 줄이 사라진다', () => {
    // 줄: 가 나 (빈) 다 라 마 바
    const cuts = lineCutsOf([false, false, true, false, false, false, false]);
    expect(cuts).not.toContain(1);
    expect(cuts).not.toContain(2);
    expect(cuts).toEqual([3]);
  });
});

describe('splitLongLinePieces', () => {
  it('상자 안 긴 문단 — 묶음마다 조각이고 상자 처음·끝 표시는 양 끝 묶음에만', () => {
    const pieces: PassagePiece[] = [{ html: poem(9), box: { label: '보기', first: true, last: true } }];
    const out = splitLongLinePieces(pieces);
    expect(out).toHaveLength(4);
    expect(linesOf(out.map((x) => x.html))).toEqual(Array.from({ length: 9 }, (_, i) => `줄${i + 1}`));
    expect(out.map((x) => x.joined ?? false)).toEqual([true, true, true, false]);
    expect(out.map((x) => x.box)).toEqual([
      { label: '보기', first: true, last: false },
      { label: '보기', first: false, last: false },
      { label: '보기', first: false, last: false },
      { label: '보기', first: false, last: true },
    ]);
  });

  it('겹친 상자 안의 긴 문단 — 안쪽 틀 표시도 양 끝 묶음에만 남는다', () => {
    const out = splitLongLinePieces([{
      html: poem(6), box: { label: '보기', first: false, last: false }, inner: { label: '가', first: true, last: true },
    }]);
    expect(out.map((x) => [x.inner?.first, x.inner?.last, x.joined ?? false])).toEqual([
      [true, false, true], [false, false, true], [false, true, false],
    ]);
    expect(out.every((x) => x.box?.first === false && x.box?.last === false)).toBe(true);
  });

  it('상자의 가운데 조각이면 처음·끝 표시를 새로 만들지 않는다', () => {
    const out = splitLongLinePieces([{ html: poem(6), box: { label: '보기', first: false, last: false } }]);
    expect(out.every((x) => x.box?.first === false && x.box?.last === false)).toBe(true);
  });

  it('상자 밖 최상위 문단도 나누고 문단 속성은 묶음마다 그대로다', () => {
    const out = splitLongLinePieces([{ html: poem(6, ' class="yet-hangul"') }]);
    expect(out.map((x) => x.html)).toEqual([
      '<p class="yet-hangul">줄1<br>줄2</p>',
      '<p class="yet-hangul">줄3<br>줄4</p>',
      '<p class="yet-hangul">줄5<br>줄6</p>',
    ]);
    expect(out.every((x) => x.box === undefined)).toBe(true);
  });

  it('짧은 문단·줄바꿈 없는 문단·그림 조각은 그대로다', () => {
    const pieces: PassagePiece[] = [
      { html: poem(5) },
      { html: '<p>긴 산문. 문장이 이어진다. 또 이어진다.</p>' },
      { html: '<p><img data-figure="1"></p>', figurePath: 'a.jpg' },
    ];
    expect(splitLongLinePieces(pieces)).toEqual(pieces);
  });

  it('꾸밈 태그 안에 줄바꿈이 있으면 나누지 않는다 — 밑줄 구절을 가르지 않는다', () => {
    const html = '<p>줄1<br>줄2<br>줄3<br><u>줄4<br>줄5</u><br>줄6<br>줄7</p>';
    expect(splitLongLinePieces([{ html }])).toEqual([{ html }]);
  });

  it('빈 줄을 지키며 나눈다', () => {
    const html = '<p>가<br>나<br><br>다<br>라<br>마<br>바</p>';
    const out = splitLongLinePieces([{ html }]);
    expect(out.map((x) => x.html)).toEqual(['<p>가<br>나<br><br>다</p>', '<p>라<br>마<br>바</p>']);
  });

  it('문단 맨 앞·맨 뒤에 빈 줄이 있으면 나누지 않는다 — 첫·끝 묶음에서 걷혀 사라진다', () => {
    const lead = `<p><br>${poem(6).slice(3, -4)}</p>`;
    const tail = `<p>${poem(6).slice(3, -4)}<br><br></p>`;
    expect(splitLongLinePieces([{ html: lead }])).toEqual([{ html: lead }]);
    expect(splitLongLinePieces([{ html: tail }])).toEqual([{ html: tail }]);
  });

  it('줄바꿈 양옆 공백은 보이지 않으므로 나누는 데 지장이 없다', () => {
    const html = '<p>가 <br> 나<br>다 <br>라<br> 마<br>바</p>';
    expect(splitLongLinePieces([{ html }]).map((x) => x.html)).toEqual(['<p>가 <br> 나</p>', '<p>다 <br>라</p>', '<p>마<br>바</p>']);
  });

  it('꾸밈 태그는 줄째 따라간다', () => {
    const html = '<p><strong>가</strong><br>나<br><u>다</u> 라<br>마<br>바<br>사</p>';
    const out = splitLongLinePieces([{ html }]);
    expect(out.map((x) => x.html)).toEqual(['<p><strong>가</strong><br>나</p>', '<p><u>다</u> 라<br>마</p>', '<p>바<br>사</p>']);
  });
});
