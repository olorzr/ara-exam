import { describe, it, expect } from 'vitest';
import { normalizeLabel, passageKeyIn, problemKeyIn, textOf } from './merge-keys';
import type { OcrItem } from './schema';

function item(over: Partial<OcrItem> = {}): OcrItem {
  return {
    kind: 'passage', ref: 'P1', page: 1, box: null, passage_ref: null, number: null,
    label: null, title: null, author: null, html: '<p>지문</p>',
    continued: false, continues: false, question_type: '객관식', stem_html: '',
    choices: [], answer: null, has_figure: false, work_title: null,
    area_path: [], unit_path: [], grammar_paths: [], ...over,
  };
}

describe('textOf', () => {
  it('태그를 걷어내고 공백을 축약한다', () => {
    expect(textOf('<p>가  나</p><p>다</p>')).toBe('가 나 다');
  });

  it('빈 HTML 은 빈 문자열', () => {
    expect(textOf('')).toBe('');
  });
});

describe('passageKeyIn', () => {
  it('이어지는 조각은 **쪽 번호만으로** 키를 만든다 — 내용이 달라져도 같은 조각이다', () => {
    const seen = new Map<string, number>();
    const a = passageKeyIn(item({ page: 4, continued: true, html: '<p>반쪽</p>' }), seen);
    const b = passageKeyIn(item({ page: 4, continued: true, html: '<p>더 온전한 글</p>' }), new Map());
    expect(a).toBe(b);
  });

  it('라벨이 있으면 라벨로, 없으면 본문 앞부분으로 가른다', () => {
    const withLabel = passageKeyIn(item({ label: '[1~3]' }), new Map());
    const other = passageKeyIn(item({ label: '[4~6]' }), new Map());
    expect(withLabel).not.toBe(other);
    expect(passageKeyIn(item({ html: '<p>다른 글</p>' }), new Map()))
      .not.toBe(passageKeyIn(item(), new Map()));
  });

  it('한 묶음에 같은 라벨이 두 번 나오면 서로 다른 지문이다 — 합치면 문항이 엉뚱한 글에 붙는다', () => {
    const seen = new Map<string, number>();
    const first = passageKeyIn(item({ label: '[1~2]' }), seen);
    const second = passageKeyIn(item({ label: '[1~2]' }), seen);
    expect(first).not.toBe(second);
  });
});

describe('problemKeyIn', () => {
  it('쪽·번호가 같으면 같은 문항', () => {
    expect(problemKeyIn(item({ kind: 'problem', page: 3, number: 5 }), new Map()))
      .toBe(problemKeyIn(item({ kind: 'problem', page: 3, number: 5 }), new Map()));
  });

  it('번호가 없으면 발문 앞부분으로 가른다', () => {
    const a = problemKeyIn(item({ kind: 'problem', number: null, stem_html: '<p>가</p>' }), new Map());
    const b = problemKeyIn(item({ kind: 'problem', number: null, stem_html: '<p>나</p>' }), new Map());
    expect(a).not.toBe(b);
  });

  it('한 묶음 안에서 번호가 반복되면 다른 문항이다 — 문제집은 절마다 1번부터 다시 센다', () => {
    const seen = new Map<string, number>();
    const first = problemKeyIn(item({ kind: 'problem', page: 2, number: 1 }), seen);
    const second = problemKeyIn(item({ kind: 'problem', page: 2, number: 1 }), seen);
    expect(first).not.toBe(second);
  });
});

describe('normalizeLabel', () => {
  it('물결표 변종을 하나로 맞춘다 — 두 묶음이 달리 읽어도 같은 지문이다', () => {
    for (const raw of ['[1~3]', '[1∼3]', '[1〜3]', '[1～3]', '[1 - 3]', '[ 1 ~ 3 ]']) {
      expect(normalizeLabel(raw)).toBe('1~3');
    }
  });

  it('전각 숫자와 감싼 괄호를 벗긴다', () => {
    expect(normalizeLabel('［４~６］')).toBe('4~6');
    expect(normalizeLabel('(7~9)')).toBe('7~9');
  });

  it('빈 값은 빈 문자열', () => {
    expect(normalizeLabel(null)).toBe('');
    expect(normalizeLabel('   ')).toBe('');
  });

  it('범위가 아닌 머리글도 그대로 다듬는다', () => {
    expect(normalizeLabel('[가]')).toBe('가');
  });
});

describe('passageKeyIn — 머리글 표기', () => {
  it('표기만 다른 같은 머리글은 같은 키다 — 안 그러면 잘린 지문 둘이 남는다', () => {
    const a = passageKeyIn(item({ label: '[1~3]' }), new Map());
    const b = passageKeyIn(item({ label: '[1 ∼ 3]' }), new Map());
    expect(a).toBe(b);
  });
});
