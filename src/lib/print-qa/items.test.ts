import { describe, expect, it } from 'vitest';
import type { PrintQaItem } from '@/types/print-scan';
import {
  answersLeftInQuestions, applyGeneratedAnswers, defaultAnswerTargets, editAnswer,
  numberPrintQaItems, planAnswerTargets, removeQaItem,
} from './items';

const item = (over: Partial<PrintQaItem> = {}): PrintQaItem => ({
  id: 'a', label: '1', lead: '', question: '물음', answer: '', answerSource: 'none',
  studentAnswer: '', evidence: '', evidenceSource: null, verified: true, leadApproved: false, ...over,
});

describe('numberPrintQaItems', () => {
  it('⚠️ 프린트에 인쇄된 번호를 그대로 찍는다 — 원본과 나란히 놓고 본다', () => {
    const rows = numberPrintQaItems([
      item({ id: 'a', label: '3' }),
      item({ id: 'b', label: '3-1' }),
      item({ id: 'c', label: '(5)' }),
    ]);
    expect(rows.map((r) => r.number)).toEqual(['3', '3-1', '(5)']);
  });

  it('번호가 없는 문항만 앞 번호 다음 수로 채운다', () => {
    const rows = numberPrintQaItems([
      item({ id: 'a', label: '3' }),
      item({ id: 'b', label: '' }),
      item({ id: 'c', label: '' }),
    ]);
    expect(rows.map((r) => r.number)).toEqual(['3', '4', '5']);
  });

  it('번호가 하나도 없으면 1번부터 센다', () => {
    const rows = numberPrintQaItems([item({ id: 'a', label: '' }), item({ id: 'b', label: '' })]);
    expect(rows.map((r) => r.number)).toEqual(['1', '2']);
  });

  it('문항을 빼면 번호가 빈다 — 원본 대조를 우선한 결과다', () => {
    const rows = numberPrintQaItems([item({ id: 'a', label: '1' }), item({ id: 'c', label: '3' })]);
    expect(rows.map((r) => r.number)).toEqual(['1', '3']);
  });
});

describe('defaultAnswerTargets', () => {
  it('답이 없거나 학생 손글씨인 것만 고른다 — 선생님이 인쇄한 답은 건드리지 않는다', () => {
    const items = [
      item({ id: 'none', answerSource: 'none' }),
      item({ id: 'hand', answerSource: 'handwritten' }),
      item({ id: 'printed', answerSource: 'printed' }),
      item({ id: 'ai', answerSource: 'ai' }),
      item({ id: 'teacher', answerSource: 'teacher' }),
    ];
    expect(defaultAnswerTargets(items)).toEqual(['none', 'hand']);
  });
});

describe('planAnswerTargets', () => {
  it('고른 것만 일련번호를 붙이고 되돌릴 표를 함께 준다', () => {
    const items = [item({ id: 'a' }), item({ id: 'b' }), item({ id: 'c' })];
    const plan = planAnswerTargets(items, new Set(['a', 'c']));
    expect(plan.targets.map((t) => t.no)).toEqual([1, 2]);
    expect(plan.byNo.get(1)).toBe('a');
    expect(plan.byNo.get(2)).toBe('c');
  });

  it('⚠️ 인쇄된 번호가 겹쳐도 일련번호는 유일하다', () => {
    const items = [item({ id: 'a', label: '(2)' }), item({ id: 'b', label: '(2)' })];
    const plan = planAnswerTargets(items, new Set(['a', 'b']));
    expect([...plan.byNo.keys()]).toEqual([1, 2]);
  });
});

describe('applyGeneratedAnswers', () => {
  it('답·근거·출처를 붙이고 출처를 ai 로 바꾼다', () => {
    const items = [item({ id: 'a' })];
    const plan = planAnswerTargets(items, new Set(['a']));
    const next = applyGeneratedAnswers(items, plan.byNo, [
      { no: 1, answer: '모범답안', evidence: '근거', source: '개념지 · 봄봄' },
    ]);
    expect(next[0]).toMatchObject({
      answer: '모범답안', answerSource: 'ai', evidence: '근거', evidenceSource: '개념지 · 봄봄',
    });
  });

  it('⚠️ 학생이 적어 둔 답은 그대로 남긴다 — 무엇을 고쳐 줘야 하는지 알아야 한다', () => {
    const items = [item({ id: 'a', answerSource: 'handwritten', answer: '비유', studentAnswer: '비유' })];
    const plan = planAnswerTargets(items, new Set(['a']));
    const next = applyGeneratedAnswers(items, plan.byNo, [
      { no: 1, answer: '은유법', evidence: '', source: null },
    ]);
    expect(next[0].answer).toBe('은유법');
    expect(next[0].studentAnswer).toBe('비유');
  });

  it('답이 안 온 문항은 그대로 둔다', () => {
    const items = [item({ id: 'a' }), item({ id: 'b' })];
    const plan = planAnswerTargets(items, new Set(['a', 'b']));
    const next = applyGeneratedAnswers(items, plan.byNo, [
      { no: 2, answer: '답', evidence: '', source: null },
    ]);
    expect(next[0].answerSource).toBe('none');
    expect(next[1].answerSource).toBe('ai');
  });
});

describe('editAnswer', () => {
  it('손으로 고친 답은 teacher 가 된다 — 다시 만들기의 기본 대상에서 빠진다', () => {
    const next = editAnswer(item({ answerSource: 'ai', answer: '옛 답', evidence: '근거', evidenceSource: '' }), '새 답');
    expect(next).toMatchObject({
      answer: '새 답', answerSource: 'teacher', evidence: '', evidenceSource: null,
    });
  });

  it('비우면 다시 none 이 된다 (공백만 남아도)', () => {
    expect(editAnswer(item({ answerSource: 'printed', answer: '답' }), '  ').answerSource).toBe('none');
  });

  it('⚠️ 적은 글자를 다듬지 않는다 — 다듬으면 칸에서 띄어쓰기를 칠 수가 없다 (코덱스 리뷰)', () => {
    // 칸이 이 값을 그대로 그리므로, 여기서 trim 하면 '관심 ' 의 공백이 칠 때마다 사라진다
    expect(editAnswer(item(), '관심 ').answer).toBe('관심 ');
    expect(editAnswer(item({ answer: '관심 ' }), '관심 표').answer).toBe('관심 표');
  });

  it('같은 값이면 그대로 둔다 — 출처를 공연히 바꾸지 않는다', () => {
    const before = item({ answerSource: 'printed', answer: '답' });
    expect(editAnswer(before, '답')).toBe(before);
  });
});

describe('removeQaItem', () => {
  it('⚠️ 지운 문항의 앞글은 뒤 문항이 물려받는다 — 안 그러면 지문이 함께 사라진다 (코덱스 2R)', () => {
    const items = [
      item({ id: 'a', lead: '[가] 지문 전문', question: '첫 물음' }),
      item({ id: 'b', lead: '', question: '둘째 물음' }),
    ];
    const next = removeQaItem(items, 'a');
    expect(next).toHaveLength(1);
    expect(next[0].lead).toBe('[가] 지문 전문');
  });

  it('뒤 문항에도 앞글이 있으면 원문 차례대로 잇는다', () => {
    const items = [
      item({ id: 'a', lead: '앞 지문' }),
      item({ id: 'b', lead: '사이 설명' }),
    ];
    expect(removeQaItem(items, 'a')[0].lead).toBe('앞 지문\n사이 설명');
  });

  it('⚠️ 물려받은 글은 승인을 되돌린다 — 아무도 안 본 글이 인쇄되면 안 된다 (Stop 게이트)', () => {
    const items = [
      item({ id: 'a', lead: '아직 확인 안 한 글', leadApproved: false }),
      item({ id: 'b', lead: '확인한 지문', leadApproved: true }),
    ];
    const next = removeQaItem(items, 'a');
    expect(next[0].lead).toBe('아직 확인 안 한 글\n확인한 지문');
    expect(next[0].leadApproved).toBe(false);
  });

  it('마지막 문항을 지우면 물려줄 곳이 없다', () => {
    const items = [item({ id: 'a' }), item({ id: 'b', lead: '앞 지문' })];
    expect(removeQaItem(items, 'b')).toHaveLength(1);
    expect(removeQaItem(items, 'b')[0].lead).toBe('');
  });

  it('없는 id 면 그대로 돌려준다', () => {
    const items = [item({ id: 'a' })];
    expect(removeQaItem(items, 'zzz')).toEqual(items);
  });
});

describe('answersLeftInQuestions', () => {
  it('⚠️ 모범답안이 붙고 나서야 드러나는 답 노출을 센다 (코덱스 23R 블로킹)', () => {
    const rows = [
      item({ id: 'a', question: '갈래는?\n소설', answer: '소설' }),
      item({ id: 'b', question: '갈래는?', answer: '소설' }),
      item({ id: 'c', question: '소설가의 삶은?', answer: '소설' }),
    ];
    expect(answersLeftInQuestions(rows)).toBe(1);
  });
});
