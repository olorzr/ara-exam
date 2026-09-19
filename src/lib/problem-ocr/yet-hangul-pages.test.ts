import { describe, it, expect } from 'vitest';
import { notationWarning, yetHangulPages, yetHangulPageWarnings } from './yet-hangul-pages';
import type { OcrItem } from './schema';

function item(over: Partial<OcrItem> = {}): OcrItem {
  return {
    kind: 'problem', ref: 'Q1', page: 1, box: null, passage_ref: null, number: 1,
    label: null, works: [], html: '',
    continued: false, continues: false,
    question_type: '객관식', stem_html: '', choices: [], answer: null, has_figure: false,
    figures: [], area_path: [], unit_path: [], grammar_paths: [],
    ...over,
  };
}

const YET = '\u1112\u119E\u11AB'; // \u1112\u119E\u11AB

describe('yetHangulPages', () => {
  it('옛한글이 보이는 쪽을 모은다 — 경고를 **쪽 단위**로 내려는 값이다', () => {
    expect(yetHangulPages([
      item({ page: 2, stem_html: `<p>${YET}</p>` }),
      item({ page: 5, html: '<p>현대 국어</p>' }),
    ])).toEqual([2]);
  });

  it('같은 쪽의 항목이 여럿이어도 한 번만 센다 — 중세국어 시험지는 거의 모든 항목에 옛 글자가 있다', () => {
    expect(yetHangulPages([
      item({ page: 3, stem_html: `<p>${YET}</p>` }),
      item({ page: 3, html: `<p>${YET}</p>` }),
      item({ page: 3, choices: [`${YET}`] }),
    ])).toEqual([3]);
  });

  it('지문·발문·선지를 모두 본다 — 선지에만 옛 글자가 있는 문항이 흔하다', () => {
    expect(yetHangulPages([item({ page: 4, choices: ['현대', YET] })])).toEqual([4]);
  });

  it('쪽 번호는 오름차순이다 — 경고 순서가 시험지 순서와 같아야 찾기 쉽다', () => {
    expect(yetHangulPages([
      item({ page: 7, html: YET }), item({ page: 2, html: YET }),
    ])).toEqual([2, 7]);
  });

  it('옛한글이 없으면 빈 배열 — 현대 국어 시험지에 경고가 붙으면 안 된다', () => {
    expect(yetHangulPages([item({ stem_html: '<p>다음 글을 읽고</p>' })])).toEqual([]);
  });
});

describe('notationWarning', () => {
  it('못 바꾼 ⟦ ⟧ 가 있으면 그 **항목**을 가리킨다 — 카드를 찾아가야 고칠 수 있다', () => {
    expect(notationWarning(item({ ref: 'Q7', page: 3, stem_html: '<p>\u27E6\u314F\u27E7</p>' })))
      .toMatchObject({ ref: 'Q7', kind: 'problem', page: 3 });
  });

  it('다 바뀐 항목은 null — 경고 상한을 헛되이 먹지 않는다', () => {
    expect(notationWarning(item({ stem_html: `<p>${YET}</p>` }))).toBeNull();
  });
});

describe('yetHangulPageWarnings', () => {
  it('옛한글이 있는 쪽마다 한 줄씩 낸다 (ref 없이 — 쪽 대상으로 풀린다)', () => {
    const warnings = yetHangulPageWarnings([
      item({ page: 2, stem_html: `<p>${YET}</p>` }),
      item({ page: 2, html: `<p>${YET}</p>` }),
    ]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ page: 2 });
    expect(warnings[0].ref).toBeUndefined();
  });

  it('현대 국어만 있으면 빈 배열', () => {
    expect(yetHangulPageWarnings([item({ stem_html: '<p>다음 글을 읽고</p>' })])).toEqual([]);
  });
});
