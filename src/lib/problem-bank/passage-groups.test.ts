import { describe, it, expect } from 'vitest';
import { groupRowsByPassage, splitByWorkSpan } from './passage-groups';

const row = (id: string, passage_id: string | null, work_titles: string[] = []) =>
  ({ id, passage_id, work_titles });

describe('groupRowsByPassage', () => {
  it('등장 순서를 지키며 이웃끼리 묶는다 — 조회가 이미 지문 순서다', () => {
    const groups = groupRowsByPassage([row('a', 'p1'), row('b', 'p1'), row('c', 'p2')]);
    expect(groups.map((g) => g.passageId)).toEqual(['p1', 'p2']);
    expect(groups[0].rows.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('지문 없는 문항은 맨 뒤에 하나로 모은다 — 사이사이면 머리가 여러 번 나온다', () => {
    const groups = groupRowsByPassage([row('a', null), row('b', 'p1'), row('c', null)]);
    expect(groups.map((g) => g.passageId)).toEqual(['p1', null]);
    expect(groups[1].rows.map((r) => r.id)).toEqual(['a', 'c']);
  });
});

describe('splitByWorkSpan', () => {
  it('다른 작품까지 묻는 문항을 갈라 낸다', () => {
    const { only, shared } = splitByWorkSpan([
      row('a', 'p1', ['진달래꽃']),
      row('b', 'p1', ['진달래꽃', '엄마 걱정']),
    ], '진달래꽃');
    expect(only.map((r) => r.id)).toEqual(['a']);
    expect(shared.map((r) => r.id)).toEqual(['b']);
  });

  it('고른 작품이 없으면 가르지 않는다 — 기준이 없으면 함께 묻는다는 말이 성립하지 않는다', () => {
    const { only, shared } = splitByWorkSpan([row('a', 'p1', ['진달래꽃', '엄마 걱정'])], '');
    expect(only).toHaveLength(1);
    expect(shared).toHaveLength(0);
  });

  it('작품명이 아예 없는 문항은 그대로 둔다 — 가를 근거가 없다', () => {
    const { only, shared } = splitByWorkSpan([row('a', 'p1', [])], '진달래꽃');
    expect(only).toHaveLength(1);
    expect(shared).toHaveLength(0);
  });

  it('고른 작품이 안 들어 있으면 함께 묻는 것이 아니다 — 조회가 잘못 걸려 온 행이다', () => {
    const { only, shared } = splitByWorkSpan([row('a', 'p1', ['봄봄', '동백꽃'])], '진달래꽃');
    expect(only).toHaveLength(1);
    expect(shared).toHaveLength(0);
  });

  it('등장 순서는 양쪽에서 그대로다', () => {
    const { only, shared } = splitByWorkSpan([
      row('a', 'p1', ['진달래꽃', '엄마 걱정']),
      row('b', 'p1', ['진달래꽃']),
      row('c', 'p1', ['진달래꽃', '엄마 걱정']),
    ], '진달래꽃');
    expect(only.map((r) => r.id)).toEqual(['b']);
    expect(shared.map((r) => r.id)).toEqual(['a', 'c']);
  });
});
