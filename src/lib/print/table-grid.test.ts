import { describe, expect, it } from 'vitest';
import { cellColumnIndices, gridColumnCount, type CellSpan } from './table-grid';
import { ROWSPAN_TO_END } from './table-row-plan';

const cell = (colSpan = 1, rowSpan = 1): CellSpan => ({ colSpan, rowSpan });

describe('cellColumnIndices', () => {
  it('병합이 없으면 셀 순서가 곧 열 인덱스다', () => {
    expect(cellColumnIndices([[cell(), cell(), cell()], [cell(), cell(), cell()]])).toEqual([
      [0, 1, 2],
      [0, 1, 2],
    ]);
  });

  it('rowspan 으로 내려온 자리를 건너뛴다', () => {
    // 0 행 첫 셀이 1 행까지 뻗음 → 1 행의 첫 셀은 1 열에서 시작
    expect(cellColumnIndices([[cell(1, 2), cell()], [cell()], [cell(), cell()]])).toEqual([[0, 1], [1], [0, 1]]);
  });

  it('colspan 은 다음 셀을 그만큼 뒤로 민다', () => {
    expect(cellColumnIndices([[cell(2), cell()], [cell(), cell(), cell()]])).toEqual([
      [0, 2],
      [0, 1, 2],
    ]);
  });

  it('rowspan 과 colspan 이 겹쳐도 격자가 맞는다', () => {
    // 0 행: [2×2 병합][c]  / 1 행: [c] / 2 행: [c][c][c]
    expect(cellColumnIndices([[cell(2, 2), cell()], [cell()], [cell(), cell(), cell()]])).toEqual([
      [0, 2],
      [2],
      [0, 1, 2],
    ]);
  });

  it('rowspan 0 은 표 끝까지 자리를 차지한다', () => {
    expect(cellColumnIndices([[cell(1, ROWSPAN_TO_END), cell()], [cell()], [cell()]])).toEqual([[0, 1], [1], [1]]);
  });

  it('표 끝을 넘는 rowspan 은 표 끝에서 멈춘다', () => {
    expect(cellColumnIndices([[cell(1, 99), cell()], [cell()]])).toEqual([[0, 1], [1]]);
  });
});

describe('gridColumnCount', () => {
  it('가장 멀리 닿은 열 끝이 열 수다', () => {
    const rows = [[cell(2, 2), cell()], [cell()], [cell(), cell(), cell()]];
    expect(gridColumnCount(rows, cellColumnIndices(rows))).toBe(3);
  });

  it('행이 없으면 0', () => {
    expect(gridColumnCount([], [])).toBe(0);
  });
});
