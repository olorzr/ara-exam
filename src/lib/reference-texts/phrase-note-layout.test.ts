import { describe, expect, it } from 'vitest';
import { groupBands, groupLines, placeBand, type BandNote, type NotePlacement } from './phrase-note-layout';

const LIMITS = { left: 0, right: 500, gap: 10 };

function note(id: number, x0: number, width: number, extra: Partial<BandNote> = {}): BandNote {
  return { id, over: false, x0, phraseRight: x0 + 40, width, span: 1, ...extra };
}

const byId = (notes: NotePlacement[], id: number) => notes.find((spot) => spot.id === id)!;

describe('placeBand', () => {
  it('풀이 하나는 구절 왼쪽 끝 밑 첫 행에 놓인다', () => {
    expect(placeBand([note(1, 100, 200)], LIMITS)).toEqual({ rows: 1, notes: [{ id: 1, dx: 0, row: 0 }] });
  });

  it('칸 오른쪽 끝을 넘으면 끝에 맞춰 왼쪽으로 당긴다', () => {
    expect(placeBand([note(1, 400, 200)], LIMITS).notes[0].dx).toBe(-100);
  });

  it('떨어진 두 풀이는 한 행을 나눠 쓴다', () => {
    expect(placeBand([note(1, 0, 100), note(2, 200, 100)], LIMITS).rows).toBe(1);
  });

  it('틈보다 가까우면 부딪힌 것이다', () => {
    const placed = placeBand([note(1, 0, 100, { phraseRight: 20 }), note(2, 105, 100, { phraseRight: 125 })], LIMITS);
    expect(byId(placed.notes, 2).dx + 105).toBeGreaterThanOrEqual(110);
  });

  it('구절 폭 안에서는 조금 밀어 한 행에 둔다', () => {
    const placed = placeBand([note(1, 0, 100), note(2, 95, 100, { phraseRight: 200 })], LIMITS);
    expect(placed.rows).toBe(1);
    expect(byId(placed.notes, 2)).toEqual({ id: 2, dx: 15, row: 0 });
  });

  it('⚠️ 제 구절을 떠날 만큼은 밀지 않고 다음 행으로 내린다 — 어느 구절 풀이인지 모르게 된다', () => {
    const placed = placeBand([note(1, 0, 300), note(2, 50, 100, { phraseRight: 90 })], LIMITS);
    expect(placed.rows).toBe(2);
    expect(byId(placed.notes, 2)).toEqual({ id: 2, dx: 0, row: 1 });
  });

  it('풀이가 많으면 그만큼 행이 는다 — 겹침이 남지 않는다', () => {
    const placed = placeBand([note(1, 0, 450), note(2, 10, 450), note(3, 20, 450), note(4, 30, 450)], LIMITS);
    expect(placed.rows).toBe(4);
    expect(new Set(placed.notes.map((spot) => spot.row)).size).toBe(4);
  });

  it('입력 차례가 달라도 왼쪽 구절부터 놓는다', () => {
    const placed = placeBand([note(2, 50, 300), note(1, 0, 300)], LIMITS);
    expect(byId(placed.notes, 1).row).toBe(0);
    expect(byId(placed.notes, 2).row).toBe(1);
  });

  it('위 풀이는 아래 줄에서부터 센다 — 한 띠의 아래 풀이와 만나지 않으면 행을 나눠 쓴다', () => {
    const placed = placeBand([note(1, 0, 100), note(2, 300, 100, { over: true })], LIMITS);
    expect(placed.rows).toBe(1);
    expect(byId(placed.notes, 2).row).toBe(0);
  });

  it('아래·위 풀이가 부딪히면 띠를 넓혀 위쪽 행과 아래쪽 행을 쓴다', () => {
    const placed = placeBand([note(1, 0, 300), note(2, 50, 100, { over: true, phraseRight: 90 })], LIMITS);
    expect(placed.rows).toBe(2);
    expect(byId(placed.notes, 1).row).toBe(0);
    expect(byId(placed.notes, 2).row).toBe(0);
  });

  it('⚠️ 아래 풀이가 위 풀이보다 밑으로 내려가지 않는다 — 재는 기준이 달라 엇갈리면 띠의 틈만큼 겹친다', () => {
    // 아래 풀이 둘이 부딪혀 하나가 둘째 행으로 내려간 띠에 그 밑 폭을 쓰는 위 풀이가 온다
    const placed = placeBand([
      note(1, 0, 200, { phraseRight: 20 }),
      note(2, 100, 200, { phraseRight: 120 }),
      note(3, 150, 100, { over: true, phraseRight: 190 }),
    ], LIMITS);
    expect(placed.rows).toBe(3);
    expect(byId(placed.notes, 2).row).toBe(1);
    expect(byId(placed.notes, 3).row).toBe(0);
  });

  it('⚠️ 위 풀이가 먼저 놓여도 뒤에 오는 아래 풀이가 그 밑으로 가지 않는다', () => {
    const placed = placeBand([
      note(1, 0, 400, { over: true, phraseRight: 20 }),
      note(2, 30, 400, { phraseRight: 70 }),
    ], LIMITS);
    expect(placed.rows).toBe(2);
    expect(byId(placed.notes, 1).row).toBe(0);
    expect(byId(placed.notes, 2).row).toBe(0);
  });

  it('꺾인 풀이는 제 행 수만큼 차지하고, 밑 행의 풀이는 그 아래로 간다', () => {
    const placed = placeBand([note(1, 0, 300, { span: 2 }), note(2, 50, 100, { phraseRight: 90 })], LIMITS);
    expect(placed.rows).toBe(3);
    expect(byId(placed.notes, 1).row).toBe(0);
    expect(byId(placed.notes, 2).row).toBe(2);
  });

  it('꺾인 위 풀이의 행은 맨 아랫줄 기준이다', () => {
    const placed = placeBand([note(1, 0, 300, { span: 2, over: true })], LIMITS);
    expect(placed).toEqual({ rows: 2, notes: [{ id: 1, dx: 0, row: 0 }] });
  });

  it('옮긴 거리는 정수다 — 인쇄 글자가 흐려지지 않게', () => {
    expect(Number.isInteger(placeBand([note(1, 400.4, 200.3)], LIMITS).notes[0].dx)).toBe(true);
  });
});

describe('groupLines', () => {
  it('첫 조각 높이가 가까운 풀이끼리 한 줄이다', () => {
    const lines = groupLines([{ top: 100 }, { top: 40 }, { top: 42 }], (item) => item.top, 10);
    expect(lines.map((line) => line.items.length)).toEqual([2, 1]);
    expect(lines[0].top).toBe(40);
  });
});

describe('groupBands', () => {
  interface Item { top: number; over: boolean }
  const bandsOf = (items: Item[]) => groupBands(groupLines(items, (item) => item.top, 10), (item) => item.over, 60);

  it('바로 이은 두 줄의 아래 풀이와 위 풀이는 한 띠다', () => {
    const bands = bandsOf([{ top: 0, over: false }, { top: 40, over: true }]);
    expect(bands).toHaveLength(1);
    expect(bands[0].items).toHaveLength(2);
    expect(bands[0].above?.top).toBe(0);
    expect(bands[0].below?.top).toBe(40);
  });

  it('줄이 떨어져 있으면 따로다', () => {
    expect(bandsOf([{ top: 0, over: false }, { top: 200, over: true }])).toHaveLength(2);
  });

  it('한 줄의 위 풀이와 아래 풀이는 다른 띠다', () => {
    const bands = bandsOf([{ top: 0, over: true }, { top: 0, over: false }]);
    expect(bands).toHaveLength(2);
    expect(bands[0].above).toBeNull();
    expect(bands[1].below).toBeNull();
  });
});
