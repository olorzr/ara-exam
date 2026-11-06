import { describe, expect, it } from 'vitest';
import type { PaperItemSnapshot } from '@/types/problem-bank';
import { displayStemHtml, questionCuts, questionStemHtml, questionChoiceLayout, questionUnits, type QuestionUnit } from './question-units';

const snap = (over: Partial<PaperItemSnapshot> = {}): PaperItemSnapshot => ({
  number: 1, question_type: '객관식', stem_html: '<p>물음</p>', choices: ['가', '나', '다', '라', '마'], answer: '1',
  score: null, explanation_html: '', area_path: [], work_title: '', render_mode: 'text', image_path: '',
  figure_paths: [], passage: null,
  source: { source_type: '내신기출', title: '', school_name: '성수고', year: '2026', grade: '고1', exam_type: '중간', publisher: '' },
  ...over,
});
const kinds = (units: readonly QuestionUnit[]) => units.map((unit) => unit.kind);

/** ᄒᆞᆫ — 첫가끝 자모로 적은 옛한글 한 음절 */
const YET = '\u1112\u119E\u11AB';

describe('displayStemHtml', () => {
  it('옛 글자가 든 문단에 글꼴 표시를 붙인다', () => {
    expect(displayStemHtml(`<p>물음</p><p>${YET}</p>`)).toBe(`<p>물음</p><p class="yet-hangul">${YET}</p>`);
  });

  it('현대 글은 정화 결과 그대로다', () => {
    expect(displayStemHtml('<p>물음</p>')).toBe('<p>물음</p>');
  });

  it('각주와 옛한글이 한 문단에 함께 붙는다', () => {
    expect(displayStemHtml(`<p>* ${YET} : 풀이</p>`)).toBe(`<p class="pb-note yet-hangul">* ${YET} : 풀이</p>`);
  });

  it('빈칸에도 표시가 붙는다', () => {
    expect(displayStemHtml('<p><u>\u3000\u3000</u></p>')).toBe('<p><u class="pb-blank">\u3000\u3000</u></p>');
  });

  it('저장값에 섞인 class 는 정화기가 지운다 — 표시는 그릴 때만 붙는다', () => {
    expect(displayStemHtml('<p class="yet-hangul">현대</p>')).toBe('<p>현대</p>');
  });

  it('조각으로 나뉜 단위에도 표시가 남는다', () => {
    const units = questionUnits(snap({ stem_html: `<p>물음</p><blockquote data-box="보기"><p>${YET}</p></blockquote>` }), false);
    expect(units[1]).toMatchObject({ kind: 'stem', box: { label: '보기' } });
    expect(units[1]).toMatchObject({ html: expect.stringContaining('class="yet-hangul"') });
  });
});

describe('questionUnits', () => {
  it('머리 · 선지 다섯', () => {
    expect(kinds(questionUnits(snap(), false))).toEqual(['head', 'choice', 'choice', 'choice', 'choice', 'choice']);
  });

  it('〈보기〉 상자는 문단마다 단위가 되고 상자 표시를 싣는다', () => {
    const units = questionUnits(snap({
      stem_html: '<p>물음</p><blockquote data-box="보기"><p>가</p><p>나</p></blockquote>', choices: [],
    }), true);
    expect(kinds(units)).toEqual(['head', 'stem', 'stem', 'answer']);
    expect(units[1]).toMatchObject({ box: { label: '보기', first: true, last: false } });
    expect(units[2]).toMatchObject({ box: { label: '보기', first: false, last: true } });
  });

  it('상자로 시작하는 발문은 머리가 상자 조각이다', () => {
    const [head] = questionUnits(snap({ stem_html: '<blockquote data-box="보기"><p>가</p></blockquote><p>물음</p>' }), false);
    expect(head).toMatchObject({ kind: 'head', box: { label: '보기' } });
  });

  it('주관식은 학생용에만 빈칸이 있고 교사용에는 답이 있다', () => {
    const open = snap({ question_type: '주관식', choices: [] });
    expect(kinds(questionUnits(open, false))).toEqual(['head', 'blank']);
    expect(kinds(questionUnits(open, true))).toEqual(['head', 'answer']);
  });

  it('짝 표 선지는 통째로 한 단위다', () => {
    const paired = snap({
      stem_html: '<p>물음</p><p>㉮ ㉯</p>',
      choices: Array.from({ length: 5 }, (_, i) => `<u>㉮</u> 가${i}<br><u>㉯</u> 나${i}`),
    });
    expect(kinds(questionUnits(paired, false))).toEqual(['head', 'choices-table']);
  });

  it('선지가 발문 표 안에 있으면 선지 단위가 없다', () => {
    const glyphs = ['①', '②', '③', '④', '⑤'];
    const tabulated = snap({
      stem_html: `<p>물음</p><table><tbody><tr>${glyphs.map((g) => `<td>${g}</td>`).join('')}</tr></tbody></table>`,
      choices: glyphs,
    });
    expect(kinds(questionUnits(tabulated, false))).toEqual(['head', 'stem']);
  });

  it('자리표시자 없는 그림은 발문 뒤에 붙고, 자리표시자가 있는 그림은 그 자리 조각이다', () => {
    expect(kinds(questionUnits(snap({ figure_paths: ['a.jpg'], choices: [] }), true))).toEqual(['head', 'figure', 'answer']);
    const placed = questionUnits(snap({ stem_html: '<p>물음</p><figure data-figure="1"></figure>', figure_paths: ['a.jpg'], choices: [] }), true);
    expect(kinds(placed)).toEqual(['head', 'stem', 'answer']);
  });

  it('경로 없는 그림의 자리표시자를 버리지 않는다 — 그리는 쪽이 눈에 보이는 안내를 찍는다', () => {
    const units = questionUnits(snap({ stem_html: '<p>물음</p><figure data-figure="1"></figure>', figure_paths: [''], choices: [] }), true);
    expect(units[1]).toMatchObject({ kind: 'stem', html: expect.stringContaining('data-figure') });
  });

  it('최상위에 날글자가 있으면 통째로 한 조각이다 — 쪼개면 그 글이 사라진다', () => {
    const html = '날글자 물음<blockquote data-box="보기"><p>가</p></blockquote>';
    const [head, next] = questionUnits(snap({ stem_html: html }), false);
    expect(head).toMatchObject({ kind: 'head', html: expect.stringContaining('날글자 물음') });
    expect(next.kind).toBe('choice');
  });

  it('최상위가 꾸밈 태그뿐이어도 통째로 한 조각이다 — 한 줄이 여러 줄로 갈리면 안 된다', () => {
    const html = '<strong>밑줄 친 </strong><u>ⓐ</u><strong>의 의미는?</strong>';
    const [head, next] = questionUnits(snap({ stem_html: html }), false);
    expect(head).toEqual({ kind: 'head', html });
    expect(next.kind).toBe('choice');
  });

  it('빈 발문도 머리가 있다', () => {
    expect(questionUnits(snap({ stem_html: '' }), false)[0]).toEqual({ kind: 'head', html: '' });
  });
});

describe('questionStemHtml', () => {
  it('표 선지의 머리를 떼고 끝 빈 문단을 걷는다', () => {
    const paired = snap({
      stem_html: '<p>물음</p><p>㉮ ㉯</p>',
      choices: Array.from({ length: 5 }, (_, i) => `<u>㉮</u> 가${i}<br><u>㉯</u> 나${i}`),
    });
    expect(questionStemHtml(paired, questionChoiceLayout(paired))).toBe('<p>물음</p>');
    const trailing = snap({ stem_html: '<p>물음</p><p></p>' });
    expect(questionStemHtml(trailing, questionChoiceLayout(trailing))).toBe('<p>물음</p>');
  });
});

describe('questionCuts', () => {
  const units = (...list: QuestionUnit['kind'][]) => list.map((kind) => ({ kind }) as QuestionUnit);

  it('첫 조각은 머리 말고 단위 하나가 더 있어야 한다', () => {
    expect(questionCuts(units('head', 'choice', 'choice', 'choice'), { from: 0, to: 4 })).toEqual([2, 3]);
  });

  it('이어진 조각은 단위 하나면 된다', () => {
    expect(questionCuts(units('head', 'choice', 'choice', 'choice'), { from: 1, to: 4 })).toEqual([2, 3]);
  });

  it('빈칸·답 앞에서는 자르지 않는다', () => {
    expect(questionCuts(units('head', 'stem', 'blank'), { from: 0, to: 3 })).toEqual([]);
    expect(questionCuts(units('head', 'stem', 'choice', 'answer'), { from: 0, to: 4 })).toEqual([2]);
  });

  it('단위가 모자라면 자리가 없다', () => {
    expect(questionCuts(units('head', 'choice'), { from: 0, to: 2 })).toEqual([]);
    expect(questionCuts(units('head', 'choice', 'choice'), { from: 2, to: 3 })).toEqual([]);
  });
});
