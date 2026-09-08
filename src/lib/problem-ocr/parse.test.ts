import { describe, it, expect } from 'vitest';
import { parseAnswerKeyDraft, parseOcrDraft } from './parse';
import type { AreaTreeNode } from '@/lib/problem-bank/area-tree';

const TREE: AreaTreeNode[] = [
  { id: '1', name: '문학', children: [{ id: '2', name: '현대시', children: [] }] },
  { id: '3', name: '독서', children: [] },
];

/** 스키마가 요구하는 모든 키를 채운 기본 항목 */
function item(over: Record<string, unknown> = {}) {
  return {
    kind: 'problem', ref: 'Q1', page: 1, box: null, passage_ref: null, number: 1,
    label: null, title: null, author: null, html: '', continued: false, continues: false,
    question_type: '객관식', stem_html: '<p>물음</p>', choices: ['가', '나', '다', '라', '마'],
    answer: '1', score: 3, has_figure: false, work_title: null, area_path: [],
    ...over,
  };
}

const ctx = { pages: [1, 2, 3], areaTree: TREE };
const json = (items: unknown[], warnings: string[] = []) => JSON.stringify({ items, warnings });

describe('parseOcrDraft — 구조', () => {
  it('JSON 이 아니면 null (형식 오류와 스키마 불일치를 구분하려고 null 로 돌려준다)', () => {
    expect(parseOcrDraft('설명 문장입니다', ctx)).toBeNull();
  });

  it('items 배열이 없으면 null', () => {
    expect(parseOcrDraft('{"warnings":[]}', ctx)).toBeNull();
  });

  it('정상 항목을 그대로 담는다', () => {
    const draft = parseOcrDraft(json([item()]), ctx)!;
    expect(draft.items).toHaveLength(1);
    expect(draft.items[0].stem_html).toBe('<p>물음</p>');
    expect(draft.items[0].choices).toHaveLength(5);
  });

  it('모델 경고를 그대로 가져온다', () => {
    const draft = parseOcrDraft(json([item()], ['정답표가 안 보여요']), ctx)!;
    expect(draft.warnings).toContain('정답표가 안 보여요');
  });
});

describe('parseOcrDraft — 항목 관대성', () => {
  it('이상한 항목만 버리고 나머지는 살린다', () => {
    const draft = parseOcrDraft(json([item({ ref: 'Q1' }), 'garbage', item({ ref: 'Q2' })]), ctx)!;
    expect(draft.items.map((i) => i.ref)).toEqual(['Q1', 'Q2']);
  });

  it('보내지 않은 쪽을 가리키면 버리고 경고한다', () => {
    const draft = parseOcrDraft(json([item({ ref: 'Q9', page: 99 })]), ctx)!;
    expect(draft.items).toHaveLength(0);
    expect(draft.warnings.join()).toContain('Q9');
  });

  it('같은 ref 가 두 번이면 먼저 온 것을 남긴다', () => {
    const draft = parseOcrDraft(
      json([item({ ref: 'Q1', number: 1 }), item({ ref: 'Q1', number: 7 })]), ctx,
    )!;
    expect(draft.items).toHaveLength(1);
    expect(draft.items[0].number).toBe(1);
  });
});

describe('parseOcrDraft — 정답·선지', () => {
  it('① 을 1 로 정규화한다 — 없으면 실제 시험지 대부분이 주관식으로 강등된다', () => {
    const draft = parseOcrDraft(json([item({ answer: '①' })]), ctx)!;
    expect(draft.items[0].answer).toBe('1');
    expect(draft.items[0].question_type).toBe('객관식');
  });

  it('(3) · 3번 · 전각 숫자도 알아본다', () => {
    for (const raw of ['(3)', '3번', '３', '3.']) {
      const draft = parseOcrDraft(json([item({ answer: raw })]), ctx)!;
      expect(draft.items[0].answer).toBe('3');
    }
  });

  it('선지 앞에 남은 번호 표시를 지운다 — 렌더가 기호를 다시 붙인다', () => {
    const draft = parseOcrDraft(
      json([item({ choices: ['① 가나', '(2) 다라', '3. 마바', '④사아', '⑤ 자차'] })]), ctx,
    )!;
    expect(draft.items[0].choices).toEqual(['가나', '다라', '마바', '사아', '자차']);
  });

  it('객관식인데 정답이 선지 번호가 아니면 주관식으로 내린다', () => {
    const draft = parseOcrDraft(json([item({ answer: '역설법' })]), ctx)!;
    expect(draft.items[0].question_type).toBe('주관식');
    expect(draft.items[0].answer).toBe('역설법');
    expect(draft.warnings.join()).toContain('역설법');
  });

  it('정답이 없으면 null 로 둔다 — 0 이나 추측으로 채우지 않는다', () => {
    const draft = parseOcrDraft(json([item({ answer: null, score: null })]), ctx)!;
    expect(draft.items[0].answer).toBeNull();
    expect(draft.items[0].score).toBeNull();
  });
});

describe('parseOcrDraft — 좌표', () => {
  it('정상 좌표를 통과시킨다', () => {
    const draft = parseOcrDraft(
      json([item({ box: { column: 1, top: 0.1, bottom: 0.4 } })]), ctx,
    )!;
    expect(draft.items[0].box).toEqual({ column: 1, top: 0.1, bottom: 0.4 });
  });

  it('범위를 벗어난 값은 가둔다', () => {
    const draft = parseOcrDraft(
      json([item({ box: { column: 0, top: -0.5, bottom: 3 } })]), ctx,
    )!;
    expect(draft.items[0].box).toEqual({ column: 0, top: 0, bottom: 1 });
  });

  it('뒤집힌 좌표는 버리되 항목은 살린다 — 크롭만 못 할 뿐 본문은 멀쩡하다', () => {
    const draft = parseOcrDraft(
      json([item({ box: { column: 1, top: 0.8, bottom: 0.2 } })]), ctx,
    )!;
    expect(draft.items).toHaveLength(1);
    expect(draft.items[0].box).toBeNull();
  });

  it('모르는 단 번호는 버린다', () => {
    const draft = parseOcrDraft(json([item({ box: { column: 7, top: 0, bottom: 1 } })]), ctx)!;
    expect(draft.items[0].box).toBeNull();
  });
});

describe('parseOcrDraft — 영역·지문 참조', () => {
  it('트리에 있는 만큼만 남긴다 — 통째로 버리면 사람이 처음부터 다시 골라야 한다', () => {
    const draft = parseOcrDraft(
      json([item({ area_path: ['문학', '현대시', '심상'] })]), ctx,
    )!;
    expect(draft.items[0].area_path).toEqual(['문학', '현대시']);
    expect(draft.warnings.join()).toContain('심상');
  });

  it('트리에 없는 영역은 비운다', () => {
    const draft = parseOcrDraft(json([item({ area_path: ['화법과작문'] })]), ctx)!;
    expect(draft.items[0].area_path).toEqual([]);
  });

  it('트리가 비었으면 검증을 건너뛴다 — 마스터를 못 읽어도 태깅은 살린다', () => {
    const draft = parseOcrDraft(json([item({ area_path: ['문법'] })]), { pages: [1] })!;
    expect(draft.items[0].area_path).toEqual(['문법']);
  });

  it('묶음 안에 없는 지문을 가리키면 끊는다 — 엉뚱한 지문에 붙는 것보다 낫다', () => {
    const draft = parseOcrDraft(json([item({ passage_ref: 'P9' })]), ctx)!;
    expect(draft.items[0].passage_ref).toBeNull();
    expect(draft.warnings.join()).toContain('P9');
  });

  it('같은 묶음의 지문 참조는 유지한다', () => {
    const passage = item({ kind: 'passage', ref: 'P1', html: '<p>지문</p>', number: null });
    const draft = parseOcrDraft(json([passage, item({ ref: 'Q1', passage_ref: 'P1' })]), ctx)!;
    expect(draft.items[1].passage_ref).toBe('P1');
  });
});

describe('parseOcrDraft — 정화', () => {
  it('본문 HTML 을 정화한다 — AI 출력은 신뢰 경계 밖이다', () => {
    const draft = parseOcrDraft(
      json([item({ stem_html: '<p onclick="alert(1)">물음</p><script>x</script>' })]), ctx,
    )!;
    expect(draft.items[0].stem_html).not.toContain('onclick');
    expect(draft.items[0].stem_html).not.toContain('script');
    expect(draft.items[0].stem_html).toContain('물음');
  });

  it('선지에서 블록 태그를 벗긴다', () => {
    const draft = parseOcrDraft(json([item({ choices: ['<p>가</p>'] })]), ctx)!;
    expect(draft.items[0].choices[0]).toBe('가');
  });
});

describe('parseAnswerKeyDraft', () => {
  const key = (answers: unknown[], warnings: string[] = []) =>
    JSON.stringify({ answers, warnings });

  it('번호·정답·배점을 담는다', () => {
    const draft = parseAnswerKeyDraft(key([{ no: 1, answer: '③', score: 3.5 }]))!;
    expect(draft.answers).toEqual([{ no: 1, answer: '3', score: 3.5 }]);
  });

  it('문항 범위를 벗어난 번호는 버린다', () => {
    const draft = parseAnswerKeyDraft(key([{ no: 99, answer: '1', score: null }]), { maxNumber: 20 })!;
    expect(draft.answers).toHaveLength(0);
    expect(draft.warnings.join()).toContain('99');
  });

  it('같은 번호가 두 번이면 먼저 읽은 값을 남긴다', () => {
    const draft = parseAnswerKeyDraft(
      key([{ no: 1, answer: '1', score: null }, { no: 1, answer: '5', score: null }]),
    )!;
    expect(draft.answers).toEqual([{ no: 1, answer: '1', score: null }]);
  });

  it('모양이 깨지면 null', () => {
    expect(parseAnswerKeyDraft('{}')).toBeNull();
    expect(parseAnswerKeyDraft('아니오')).toBeNull();
  });
});
