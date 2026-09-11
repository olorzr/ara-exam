import { describe, it, expect } from 'vitest';
import { labelRange, verifyStructure } from './verify-structure';
import { warningText } from './warnings';
import type { PassageDraft, ProblemDraft } from './merge';

let seq = 0;
const id = () => `id${++seq}`;

function problem(over: Partial<ProblemDraft> = {}): ProblemDraft {
  return {
    id: id(), passage_id: null, number: 1, question_type: '객관식',
    stem_html: '<p>물음</p>', choices: ['가', '나', '다', '라', '마'], answer: '1', score: null,
    work_title: '', area_path: [], unit_path: [], grammar_paths: [],
    page_no: 1, box: null, has_figure: false, figures: [], ...over,
  };
}

function passage(over: Partial<PassageDraft> = {}): PassageDraft {
  return {
    id: id(), label: '', title: '', author: '', html: '<p>지문</p>', page_no: 1, box: null,
    area_path: [], unit_path: [], has_figure: false, figures: [], lastPage: 1, open: false,
    pageSpan: 1,
    ...over,
  };
}

/** 다섯 지선다 문항을 번호대로 */
const run = (numbers: number[], over: Partial<ProblemDraft> = {}) =>
  numbers.map((n) => problem({ number: n, ...over }));

const said = (warnings: ReturnType<typeof verifyStructure>) =>
  warnings.map(warningText).join(' | ');

describe('labelRange', () => {
  it('범위 머리글을 번호로 편다', () => {
    expect(labelRange('[1~3]')).toEqual([1, 2, 3]);
    expect(labelRange('4 ∼ 6')).toEqual([4, 5, 6]);
  });

  it('범위가 아니면 빈 배열', () => {
    expect(labelRange('가')).toEqual([]);
    expect(labelRange('')).toEqual([]);
  });

  it('뒤집혔거나 터무니없이 넓으면 안 믿는다 — 잘못 읽은 머리글이다', () => {
    expect(labelRange('[9~2]')).toEqual([]);
    expect(labelRange('[1~90]')).toEqual([]);
  });
});

describe('verifyStructure — 빠진 번호', () => {
  it('번호가 건너뛴 자리를 알린다 — 못 읽은 문항의 가장 분명한 신호다', () => {
    const merged = { passages: [], problems: run([1, 2, 4, 5, 6]) };
    expect(said(verifyStructure(merged))).toContain('3번이 안 보여요');
  });

  it('빠진 번호의 앞뒤 문항이 있는 쪽을 짚는다 — 빠진 문항에는 카드가 없다', () => {
    const merged = {
      passages: [],
      problems: [
        problem({ number: 1, page_no: 2 }), problem({ number: 2, page_no: 2 }),
        problem({ number: 4, page_no: 3 }), problem({ number: 5, page_no: 3 }),
      ],
    };
    const [warning] = verifyStructure(merged);
    expect(warningText(warning)).toContain('3번');
    expect(warningText(warning)).toContain('2쪽');
    expect(warningText(warning)).toContain('3쪽');
  });

  it('번호가 겹치는 자료는 검사하지 않는다 — 문제집은 절마다 1번부터 다시 센다', () => {
    const merged = { passages: [], problems: run([1, 2, 3, 1, 2, 5]) };
    expect(said(verifyStructure(merged))).not.toContain('안 보여요');
  });

  it('번호가 너무 띄엄띄엄하면 검사하지 않는다 — 쪽을 골라 읽은 것이다', () => {
    const merged = { passages: [], problems: run([1, 2, 30, 31]) };
    expect(said(verifyStructure(merged))).not.toContain('안 보여요');
  });

  it('빠짐이 없으면 아무 말도 안 한다', () => {
    expect(verifyStructure({ passages: [], problems: run([1, 2, 3]) })).toEqual([]);
  });
});

describe('verifyStructure — 선지 수', () => {
  it('객관식인데 선지가 하나도 없으면 알린다 — 아무도 말해 주지 않는 자리다', () => {
    const merged = {
      passages: [],
      problems: [problem({ number: 1, stem_html: '<p>다음 중 옳은 것은?</p>', choices: [] })],
    };
    expect(said(verifyStructure(merged))).toContain('선지를 하나도 읽지 못했어요');
  });

  it('발문도 없으면 말하지 않는다 — 다른 경고가 이미 붙는 자리다', () => {
    const merged = {
      passages: [],
      problems: [problem({ number: 1, stem_html: '', choices: [] })],
    };
    expect(said(verifyStructure(merged))).not.toContain('선지를 하나도');
  });

  it('선지가 하나뿐이면 알린다', () => {
    const merged = { passages: [], problems: [problem({ number: 1, choices: ['가'] })] };
    expect(said(verifyStructure(merged))).toContain('선지를 1개만');
  });

  it('이 시험지에서 혼자만 선지 수가 다르면 알린다', () => {
    const merged = {
      passages: [],
      problems: [
        ...run([1, 2, 3, 4]),
        problem({ number: 5, choices: ['가', '나', '다', '라'] }),
      ],
    };
    const text = said(verifyStructure(merged));
    expect(text).toContain('선지가 4개예요');
    expect(text).toContain('보통 5개');
  });

  it('4지선다 시험지는 4개가 정상이다 — 다수결로 기준을 잡는다', () => {
    const four = ['가', '나', '다', '라'];
    const merged = { passages: [], problems: run([1, 2, 3, 4], { choices: four }) };
    expect(said(verifyStructure(merged))).not.toContain('선지가');
  });

  it('주관식은 선지가 없어도 정상이다', () => {
    const merged = {
      passages: [],
      problems: run([1, 2, 3]).concat(
        problem({ number: 4, question_type: '서술형', choices: [], answer: '답' }),
      ),
    };
    expect(said(verifyStructure(merged))).not.toContain('선지');
  });

  it('형식이 뒤섞인 자료에는 기준을 세우지 않는다', () => {
    const merged = {
      passages: [],
      problems: [
        ...run([1, 2]),
        ...run([3, 4], { choices: ['가', '나', '다', '라'] }),
      ],
    };
    expect(said(verifyStructure(merged))).not.toContain('보통');
  });
});

describe('verifyStructure — 머리글과 문항', () => {
  it('머리글이 가리키는 문항이 지문에 안 붙었으면 알린다', () => {
    const p = passage({ label: '[1~3]' });
    const merged = {
      passages: [p],
      problems: [
        problem({ number: 1, passage_id: p.id }),
        problem({ number: 2, passage_id: p.id }),
        // 3번이 지문에 안 붙었다 — 인쇄하면 지문 없이 나간다
        problem({ number: 3, passage_id: null }),
      ],
    };
    const text = said(verifyStructure(merged));
    expect(text).toContain('3번이 이 지문에 붙어 있지 않아요');
    // 지문 카드와 그 문항 카드 둘 다 짚는다
    expect(text).toContain('1쪽 지문');
    expect(text).toContain('3번');
  });

  it('다 붙어 있으면 아무 말도 안 한다', () => {
    const p = passage({ label: '[1~2]' });
    const merged = {
      passages: [p],
      problems: [
        problem({ number: 1, passage_id: p.id }),
        problem({ number: 2, passage_id: p.id }),
      ],
    };
    expect(verifyStructure(merged)).toEqual([]);
  });

  it('아직 못 읽은 번호는 머리글 경고로 두 번 말하지 않는다 — 빠진 번호 경고가 이미 있다', () => {
    const p = passage({ label: '[1~3]' });
    const merged = {
      passages: [p],
      problems: [
        problem({ number: 1, passage_id: p.id }),
        problem({ number: 2, passage_id: p.id }),
      ],
    };
    expect(said(verifyStructure(merged))).not.toContain('붙어 있지 않아요');
  });

  it('범위 머리글이 없는 지문은 검사하지 않는다', () => {
    const merged = { passages: [passage({ label: '' })], problems: run([1, 2]) };
    expect(verifyStructure(merged)).toEqual([]);
  });
});
