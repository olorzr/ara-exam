import { describe, expect, it } from 'vitest';
import { legalCutFlags, planRowChunks, ROWSPAN_TO_END } from './table-row-plan';

describe('legalCutFlags', () => {
  it('병합이 없으면 어디서든 자를 수 있다', () => {
    expect(legalCutFlags([[1, 1], [1, 1], [1, 1]])).toEqual([true, true, true]);
  });

  it('rowspan 이 뻗은 행 앞에서는 못 자른다', () => {
    // 1 행의 셀이 2 행까지 뻗음 → 2 행 앞 절단 불가
    expect(legalCutFlags([[1, 1], [2, 1], [1], [1, 1]])).toEqual([true, true, false, true]);
  });

  it('겹친 병합은 가장 멀리 뻗은 쪽을 따른다', () => {
    // 0 행 셀이 3 행까지(span 3), 1 행 셀이 2 행까지(span 2)
    expect(legalCutFlags([[3, 1], [2], [1], [1, 1]])).toEqual([true, false, false, true]);
  });

  it('colspan 만 있는 표는 절단에 영향이 없다 (rowspan 은 전부 1)', () => {
    expect(legalCutFlags([[1], [1, 1, 1], [1, 1]])).toEqual([true, true, true]);
  });

  it('rowspan="0" 은 표 끝까지 뻗어 이후 절단을 전부 막는다', () => {
    expect(legalCutFlags([[ROWSPAN_TO_END, 1], [1], [1], [1]])).toEqual([true, false, false, false]);
  });
});

describe('planRowChunks', () => {
  const allLegal = (n: number) => Array.from({ length: n }, () => true);

  it('용량에 맞춰 그리디로 나눈다', () => {
    expect(planRowChunks([30, 30, 30, 30], allLegal(4), 65)).toEqual([
      { start: 0, end: 1 },
      { start: 2, end: 3 },
    ]);
  });

  it('절단 금지 행을 만나면 가장 최근 합법 절단점으로 물러난다', () => {
    // 2 행 앞에서 못 자르므로 1~2 행이 한 조각으로 묶인다
    const chunks = planRowChunks([30, 30, 30, 30], [true, true, false, true], 65);
    expect(chunks).toEqual([
      { start: 0, end: 0 },
      { start: 1, end: 2 },
      { start: 3, end: 3 },
    ]);
  });

  it('용량보다 큰 병합 묶음은 통째로 한 조각에 남긴다 (엔진이 축소한다)', () => {
    const chunks = planRowChunks([200, 200, 200, 30], [true, false, false, true], 500);
    expect(chunks).toEqual([
      { start: 0, end: 2 },
      { start: 3, end: 3 },
    ]);
  });

  it('다 들어가면 조각은 하나다', () => {
    expect(planRowChunks([30, 30], allLegal(2), 500)).toEqual([{ start: 0, end: 1 }]);
  });

  it('행이 없으면 조각도 없다', () => {
    expect(planRowChunks([], [], 100)).toEqual([]);
  });

  it('모든 행을 빠짐없이 한 번씩만 덮는다', () => {
    const heights = [40, 25, 60, 35, 20, 50, 30];
    const legal = [true, true, false, true, false, true, true];
    const chunks = planRowChunks(heights, legal, 90);
    const covered = chunks.flatMap((c) => Array.from({ length: c.end - c.start + 1 }, (_, i) => c.start + i));
    expect(covered).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});
