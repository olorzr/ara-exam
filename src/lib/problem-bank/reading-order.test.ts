import { describe, it, expect } from 'vitest';
import { sortByReadingOrder } from './reading-order';

/** 정렬에 쓰는 것만 있는 지문 흉내 — `Pick<Passage, 'page_no' | 'bbox'>` 를 만족한다 */
type Row = { id: string; page_no: number; bbox: never };

const at = (id: string, page_no: number, bbox: unknown) =>
  ({ id, page_no, bbox }) as Row;
const order = (rows: Row[]) => sortByReadingOrder(rows).map((r) => r.id);

describe('sortByReadingOrder', () => {
  it('쪽이 먼저다', () => {
    expect(order([
      at('b', 4, { column: 1, top: 0.1, bottom: 0.5 }),
      at('a', 3, { column: 2, top: 0.8, bottom: 0.9 }),
    ])).toEqual(['a', 'b']);
  });

  it('같은 쪽이면 왼쪽 단이 먼저다 — UUID 차례는 원본과 무관하다', () => {
    expect(order([
      at('right', 3, { column: 2, top: 0.1, bottom: 0.4 }),
      at('left', 3, { column: 1, top: 0.5, bottom: 0.9 }),
    ])).toEqual(['left', 'right']);
  });

  it('같은 단이면 위에 있는 것이 먼저다', () => {
    expect(order([
      at('below', 3, { column: 1, top: 0.6, bottom: 0.9 }),
      at('above', 3, { column: 1, top: 0.1, bottom: 0.4 }),
    ])).toEqual(['above', 'below']);
  });

  it('쪽 전체 폭 지문이 단보다 먼저다 — 머리 지문이 그렇다', () => {
    expect(order([
      at('col', 3, { column: 1, top: 0.1, bottom: 0.4 }),
      at('full', 3, { column: 0, top: 0.5, bottom: 0.9 }),
    ])).toEqual(['full', 'col']);
  });

  it('옛 행의 정규화 사각형도 단으로 가늠한다', () => {
    expect(order([
      at('right', 3, { x: 0.52, y: 0.1, w: 0.48, h: 0.3 }),
      at('left', 3, { x: 0, y: 0.6, w: 0.48, h: 0.3 }),
    ])).toEqual(['left', 'right']);
  });

  it('좌표가 없으면 맨 뒤로 — 어디인지 모르니 남의 차례를 흔들지 않는다', () => {
    expect(order([
      at('unknown', 3, null),
      at('known', 3, { column: 2, top: 0.9, bottom: 0.95 }),
    ])).toEqual(['known', 'unknown']);
  });

  it('원본 배열을 건드리지 않는다', () => {
    const rows = [at('b', 4, null), at('a', 3, null)];
    sortByReadingOrder(rows);
    expect(rows.map((r) => r.id)).toEqual(['b', 'a']);
  });
});
