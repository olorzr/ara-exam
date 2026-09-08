import { describe, it, expect } from 'vitest';
import {
  groupRangeLabel,
  groupsOf,
  insertItems,
  isContiguous,
  moveGroup,
  moveItem,
  removeItem,
  renumber,
  type PaperItem,
} from './compose';

/** 'a:P1' → 지문 P1 의 문항 a. 'b' → 지문 없는 문항 b */
const items = (spec: string): PaperItem[] =>
  spec.split(' ').filter(Boolean).map((s) => {
    const [problemId, passageId] = s.split(':');
    return { problemId, passageId: passageId ?? null };
  });

const show = (list: PaperItem[]) =>
  list.map((i) => (i.passageId ? `${i.problemId}:${i.passageId}` : i.problemId)).join(' ');

describe('groupsOf', () => {
  it('연속한 같은 지문을 묶는다', () => {
    expect(groupsOf(items('a:P1 b:P1 c:P2'))).toEqual([
      { passageId: 'P1', start: 0, end: 1 },
      { passageId: 'P2', start: 2, end: 2 },
    ]);
  });

  it('지문 없는 문항은 서로 합치지 않는다 — 무관한 문항들이다', () => {
    expect(groupsOf(items('a b'))).toHaveLength(2);
  });
});

describe('isContiguous', () => {
  it('같은 지문이 붙어 있으면 통과', () => {
    expect(isContiguous(items('a:P1 b:P1 c:P2'))).toBe(true);
  });

  it('같은 지문이 흩어져 있으면 실패 — 인쇄에서 지문이 두 번 나온다', () => {
    expect(isContiguous(items('a:P1 c:P2 b:P1'))).toBe(false);
  });

  it('지문 없는 문항이 사이에 끼어도 흩어진 것이다', () => {
    expect(isContiguous(items('a:P1 x b:P1'))).toBe(false);
  });

  it('빈 캔버스도 통과', () => {
    expect(isContiguous([])).toBe(true);
  });
});

describe('insertItems', () => {
  it('원하는 자리에 넣는다', () => {
    expect(show(insertItems(items('a b'), items('c'), 1))).toBe('a c b');
  });

  it('맨 앞·맨 뒤에도 넣는다', () => {
    expect(show(insertItems(items('a b'), items('c'), 0))).toBe('c a b');
    expect(show(insertItems(items('a b'), items('c'), 99))).toBe('a b c');
  });

  it('이미 있는 문항은 다시 넣지 않는다 — 같은 문항을 두 번 출제할 수 없다', () => {
    expect(show(insertItems(items('a b'), items('a'), 0))).toBe('a b');
  });

  it('한 번에 넣는 목록 안의 중복도 거른다', () => {
    expect(show(insertItems([], items('a a b'), 0))).toBe('a b');
  });

  it('같은 지문이 이미 있으면 자리를 무시하고 그 묶음 끝에 붙인다', () => {
    // 맨 앞(0)에 넣으라고 해도 P1 묶음 끝으로 간다
    expect(show(insertItems(items('a:P1 b:P1 c:P2'), items('d:P1'), 0))).toBe('a:P1 b:P1 d:P1 c:P2');
  });

  it('남의 지문 묶음 한가운데에 떨어뜨리면 묶음 끝으로 민다', () => {
    expect(show(insertItems(items('a:P1 b:P1'), items('x'), 1))).toBe('a:P1 b:P1 x');
  });

  it('묶음 경계(앞)에는 그대로 들어간다', () => {
    expect(show(insertItems(items('a:P1 b:P1'), items('x'), 0))).toBe('x a:P1 b:P1');
  });

  it('여러 개를 넣어도 순서와 연속성이 유지된다', () => {
    const out = insertItems(items('z'), items('a:P1 b:P1 c:P2'), 0);
    expect(show(out)).toBe('a:P1 b:P1 c:P2 z');
    expect(isContiguous(out)).toBe(true);
  });

  it('원본을 바꾸지 않는다', () => {
    const before = items('a');
    insertItems(before, items('b'), 0);
    expect(before).toHaveLength(1);
  });
});

describe('moveItem', () => {
  it('지문 없는 문항은 자유롭게 옮긴다', () => {
    expect(show(moveItem(items('a b c'), 0, 2))).toBe('b c a');
  });

  it('지문 묶음 안에서 순서를 바꾼다', () => {
    expect(show(moveItem(items('a:P1 b:P1 c:P1'), 2, 0))).toBe('c:P1 a:P1 b:P1');
  });

  it('묶음 밖으로는 못 나간다 — 경계에서 멈춘다', () => {
    const out = moveItem(items('a:P1 b:P1 c:P2'), 0, 2);
    expect(show(out)).toBe('b:P1 a:P1 c:P2');
    expect(isContiguous(out)).toBe(true);
  });

  it('단독 문항이 지문 묶음 한가운데에 서지 않는다 — 서면 지문이 갈라져 저장이 거부된다', () => {
    // 코덱스 리뷰 9R: X 를 한 칸 올리면 [A:P, X, B:P] 가 되어 P 가 쪼개졌다
    const out = moveItem(items('a:P1 b:P1 x'), 2, 1);
    expect(isContiguous(out)).toBe(true);
    expect(show(out)).toBe('x a:P1 b:P1');
  });

  it('아래로 옮길 때도 묶음을 건너뛴다', () => {
    const out = moveItem(items('x a:P1 b:P1'), 0, 1);
    expect(isContiguous(out)).toBe(true);
    expect(show(out)).toBe('a:P1 b:P1 x');
  });

  it('문항 하나짜리 묶음은 그냥 지나칠 수 있다', () => {
    const out = moveItem(items('a:P1 x'), 1, 0);
    expect(isContiguous(out)).toBe(true);
    expect(show(out)).toBe('x a:P1');
  });

  it('어떤 이동도 연속성을 깨지 않는다', () => {
    const source = items('a:P1 b:P1 x c:P2 d:P2 y');
    for (let from = 0; from < source.length; from += 1) {
      for (let to = 0; to < source.length; to += 1) {
        expect(isContiguous(moveItem(source, from, to))).toBe(true);
      }
    }
  });

  it('범위 밖 index 는 무시한다', () => {
    expect(show(moveItem(items('a b'), 5, 0))).toBe('a b');
  });

  it('제자리면 그대로', () => {
    expect(show(moveItem(items('a b'), 1, 1))).toBe('a b');
  });
});

describe('moveGroup', () => {
  it('지문 묶음을 통째로 옮긴다', () => {
    expect(show(moveGroup(items('a:P1 b:P1 c:P2'), 1, 0))).toBe('c:P2 a:P1 b:P1');
  });

  it('옮긴 뒤에도 연속성이 유지된다', () => {
    const out = moveGroup(items('a:P1 b:P1 c:P2 d:P2'), 0, 1);
    expect(show(out)).toBe('c:P2 d:P2 a:P1 b:P1');
    expect(isContiguous(out)).toBe(true);
  });

  it('범위를 벗어난 목표는 가둔다', () => {
    expect(show(moveGroup(items('a:P1 b:P2'), 0, 99))).toBe('b:P2 a:P1');
  });
});

describe('removeItem / renumber / groupRangeLabel', () => {
  it('문항을 빼면 지문도 자연히 사라진다', () => {
    expect(show(removeItem(items('a:P1 b:P2'), 'a'))).toBe('b:P2');
  });

  it('번호는 1부터 다시 센다 — 원본 번호와 무관하다', () => {
    expect(renumber(items('a b c'))).toEqual([1, 2, 3]);
  });

  it('지문 머리글 범위를 만든다', () => {
    expect(groupRangeLabel({ passageId: 'P1', start: 2, end: 4 })).toBe('3~5');
    expect(groupRangeLabel({ passageId: 'P1', start: 0, end: 0 })).toBe('1');
  });
});
