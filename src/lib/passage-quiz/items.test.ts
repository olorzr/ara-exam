import { describe, it, expect } from 'vitest';
import { numberQuizItems, toQuizItems, type QuizItem } from './items';
import type { PassageQuizResult } from './parse';

const result: PassageQuizResult = {
  ox: [
    { statement: '진술 1', answer: 'O', evidence: '근거 1', source: '' },
    { statement: '진술 2', answer: 'X', evidence: '근거 2', source: '개념지 · 봄봄' },
  ],
  short: [{ question: '질문 1', answer: '답 1', evidence: '근거 3', source: '' }],
  dropped: { evidenceNotInText: 0, answerNotInText: 0, duplicate: 0, malformed: 0 },
};

const item = (over: Partial<QuizItem>): QuizItem => ({
  id: 'x', kind: 'ox', text: 't', answer: 'O', evidence: 'e', source: '', ...over,
});

describe('toQuizItems', () => {
  it('O,X 를 먼저, 단답형을 다음에 눕힌다', () => {
    const items = toQuizItems(result, 'seed');
    expect(items.map((i) => i.kind)).toEqual(['ox', 'ox', 'short']);
    expect(items[0]).toEqual({
      id: 'seed-ox-0', kind: 'ox', text: '진술 1', answer: 'O', evidence: '근거 1', source: '',
    });
    expect(items[2]).toEqual({
      id: 'seed-short-0', kind: 'short', text: '질문 1', answer: '답 1', evidence: '근거 3',
      source: '',
    });
  });

  it('근거의 출처를 그대로 들고 간다 — 정답표가 그것을 찍는다', () => {
    expect(toQuizItems(result, 'seed')[1].source).toBe('개념지 · 봄봄');
  });

  it('id 는 실행마다 갈린다 — 옛 목록과 섞이면 수정·삭제가 엉뚱한 문항에 간다', () => {
    const a = toQuizItems(result, 'a');
    const b = toQuizItems(result, 'b');
    expect(a.map((i) => i.id)).not.toEqual(b.map((i) => i.id));
  });
});

describe('numberQuizItems', () => {
  it('유형이 섞여 있어도 O,X 먼저 1번부터 매긴다 — 문제지와 정답표가 이 함수 하나를 쓴다', () => {
    const numbered = numberQuizItems([
      item({ id: 's1', kind: 'short' }),
      item({ id: 'o1', kind: 'ox' }),
      item({ id: 's2', kind: 'short' }),
    ]);
    expect(numbered.map((n) => [n.item.id, n.number])).toEqual([
      ['o1', 1], ['s1', 2], ['s2', 3],
    ]);
  });

  it('문항을 지우면 번호가 다시 이어진다', () => {
    const numbered = numberQuizItems([item({ id: 'o2', kind: 'ox' })]);
    expect(numbered[0].number).toBe(1);
  });
});
