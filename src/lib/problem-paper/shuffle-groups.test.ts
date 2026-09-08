import { describe, it, expect } from 'vitest';
import { shuffleGroups } from './shuffle-groups';
import { isContiguous, type PaperItem } from './compose';

const items = (spec: string): PaperItem[] =>
  spec.split(' ').filter(Boolean).map((s) => {
    const [problemId, passageId] = s.split(':');
    return { problemId, passageId: passageId ?? null };
  });

const show = (list: PaperItem[]) =>
  list.map((i) => (i.passageId ? `${i.problemId}:${i.passageId}` : i.problemId)).join(' ');

/** 뒤집기 — 결정론적인 '섞기' */
const reverse = <T,>(arr: readonly T[]): T[] => [...arr].reverse();

describe('shuffleGroups', () => {
  it('묶음 단위로 섞고 묶음 안 순서는 유지한다', () => {
    const out = shuffleGroups(items('a:P1 b:P1 c:P2 d:P2'), reverse);
    expect(show(out)).toBe('c:P2 d:P2 a:P1 b:P1');
  });

  it('어떻게 섞여도 같은 지문은 붙어 있다 — 흩어지면 지문이 두 번 인쇄된다', () => {
    const source = items('a:P1 b:P1 c:P2 d e:P3 f:P3');
    for (let i = 0; i < 30; i += 1) {
      expect(isContiguous(shuffleGroups(source))).toBe(true);
    }
  });

  it('문항 수는 보존된다', () => {
    const source = items('a:P1 b:P1 c d:P2');
    expect(shuffleGroups(source, reverse)).toHaveLength(source.length);
  });

  it('빈 캔버스도 안전하다', () => {
    expect(shuffleGroups([])).toEqual([]);
  });

  it('지문 없는 문항끼리는 자유롭게 섞인다', () => {
    expect(show(shuffleGroups(items('a b c'), reverse))).toBe('c b a');
  });
});
