import { describe, it, expect } from 'vitest';
import { groupRowsByPassage } from './passage-groups';

const row = (id: string, passage_id: string | null) => ({ id, passage_id });

describe('groupRowsByPassage', () => {
  it('같은 지문의 문항을 한 묶음으로', () => {
    const groups = groupRowsByPassage([row('1', 'p1'), row('2', 'p1'), row('3', 'p2')]);
    expect(groups.map((g) => g.passageId)).toEqual(['p1', 'p2']);
    expect(groups[0].rows.map((r) => r.id)).toEqual(['1', '2']);
  });

  it('조회 순서를 그대로 지킨다 — 다시 정렬하면 화면과 쪽 나누기가 어긋난다', () => {
    const groups = groupRowsByPassage([row('1', 'p2'), row('2', 'p1')]);
    expect(groups.map((g) => g.passageId)).toEqual(['p2', 'p1']);
  });

  it('떨어져 있어도 같은 지문이면 한 묶음이다 — 머리가 두 번 나오면 안 된다', () => {
    const groups = groupRowsByPassage([row('1', 'p1'), row('2', 'p2'), row('3', 'p1')]);
    expect(groups).toHaveLength(2);
    expect(groups[0].rows.map((r) => r.id)).toEqual(['1', '3']);
  });

  it('지문 없는 문항은 맨 뒤에 하나로 모은다', () => {
    const groups = groupRowsByPassage([row('1', null), row('2', 'p1'), row('3', null)]);
    expect(groups.map((g) => g.passageId)).toEqual(['p1', null]);
    expect(groups[1].rows.map((r) => r.id)).toEqual(['1', '3']);
  });

  it('지문이 하나도 없으면 묶음도 하나', () => {
    const groups = groupRowsByPassage([row('1', null)]);
    expect(groups).toEqual([{ passageId: null, rows: [row('1', null)] }]);
  });

  it('빈 목록이면 빈 결과', () => {
    expect(groupRowsByPassage([])).toEqual([]);
  });
});
