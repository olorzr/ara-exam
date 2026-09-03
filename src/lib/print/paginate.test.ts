import { describe, expect, it } from 'vitest';
import { CAPACITY_SAFETY_PX } from './constants';
import { findBlockPage, paginate } from './paginate';

/** 테스트 가독성을 위해 안전 마진을 미리 얹은 본문 높이 */
const body = (usable: number) => usable + CAPACITY_SAFETY_PX;

describe('paginate', () => {
  it('블록이 없으면 페이지도 없다', () => {
    const result = paginate({
      blockHeights: [],
      columns: 1,
      firstPageBodyHeight: body(100),
      laterPageBodyHeight: body(100),
    });
    expect(result.pages).toEqual([]);
    expect(result.oversized).toEqual([]);
  });

  it('용량 안이면 한 페이지에 모두 담는다', () => {
    const result = paginate({
      blockHeights: [30, 30, 30],
      columns: 1,
      firstPageBodyHeight: body(100),
      laterPageBodyHeight: body(100),
    });
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].columns[0]).toEqual([0, 1, 2]);
  });

  it('넘치면 다음 페이지로 넘기고 순서를 유지한다', () => {
    const result = paginate({
      blockHeights: [40, 40, 40, 40],
      columns: 1,
      firstPageBodyHeight: body(100),
      laterPageBodyHeight: body(100),
    });
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0].columns[0]).toEqual([0, 1]);
    expect(result.pages[1].columns[0]).toEqual([2, 3]);
  });

  it('1페이지는 전체 헤더 때문에 용량이 작다', () => {
    const result = paginate({
      blockHeights: [40, 40, 40],
      columns: 1,
      firstPageBodyHeight: body(50),
      laterPageBodyHeight: body(100),
    });
    expect(result.pages[0].columns[0]).toEqual([0]);
    expect(result.pages[1].columns[0]).toEqual([1, 2]);
  });

  it('2단은 좌 → 우 컬럼 순으로 채운 뒤 다음 페이지로 간다', () => {
    const result = paginate({
      blockHeights: [60, 60, 60, 60, 60],
      columns: 2,
      firstPageBodyHeight: body(100),
      laterPageBodyHeight: body(100),
    });
    expect(result.pages).toHaveLength(3);
    expect(result.pages[0].columns).toEqual([[0], [1]]);
    expect(result.pages[1].columns).toEqual([[2], [3]]);
    expect(result.pages[2].columns).toEqual([[4], []]);
  });

  it('컬럼 헤더 높이는 모든 컬럼 용량에서 빠진다', () => {
    const result = paginate({
      blockHeights: [50, 50],
      columns: 1,
      firstPageBodyHeight: body(100),
      laterPageBodyHeight: body(100),
      columnHeaderHeight: 20,
    });
    // 용량 80 — 50 두 개는 못 들어간다
    expect(result.pages).toHaveLength(2);
  });

  it('한 페이지보다 큰 블록은 단독 배치하고 oversized 로 표시한다', () => {
    const result = paginate({
      blockHeights: [30, 500, 30],
      columns: 1,
      firstPageBodyHeight: body(100),
      laterPageBodyHeight: body(100),
    });
    expect(result.oversized).toEqual([1]);
    expect(result.pages).toHaveLength(3);
    expect(result.pages[0].columns[0]).toEqual([0]);
    expect(result.pages[1].columns[0]).toEqual([1]);
    expect(result.pages[2].columns[0]).toEqual([2]);
  });

  it('첫 블록이 커도 빈 페이지를 앞에 만들지 않는다', () => {
    const result = paginate({
      blockHeights: [500],
      columns: 1,
      firstPageBodyHeight: body(100),
      laterPageBodyHeight: body(100),
    });
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].columns[0]).toEqual([0]);
    expect(result.oversized).toEqual([0]);
  });

  it('2단에서 큰 블록을 단독 배치할 때 왼쪽 컬럼을 비워 두지 않는다', () => {
    const result = paginate({
      blockHeights: [500, 30],
      columns: 2,
      firstPageBodyHeight: body(100),
      laterPageBodyHeight: body(100),
    });
    expect(result.oversized).toEqual([0]);
    expect(result.pages[0].columns).toEqual([[0], []]);
    expect(result.pages[1].columns[0]).toEqual([1]);
  });

  it('모든 블록이 정확히 한 번씩만 배치된다', () => {
    const heights = Array.from({ length: 137 }, (_, i) => 20 + (i % 7) * 5);
    const result = paginate({
      blockHeights: heights,
      columns: 2,
      firstPageBodyHeight: body(400),
      laterPageBodyHeight: body(500),
    });
    const placed = result.pages.flatMap((page) => page.columns.flat());
    expect(placed).toHaveLength(heights.length);
    expect([...placed].sort((a, b) => a - b)).toEqual(heights.map((_, i) => i));
    expect(placed).toEqual([...placed].sort((a, b) => a - b)); // 순서 보존
  });
});

describe('paginate — 분할 요청', () => {
  it('남은 자리에 안 들어가면 그 자리 크기로 분할을 요청한다', () => {
    const result = paginate({
      blockHeights: [40, 80],
      columns: 1,
      firstPageBodyHeight: body(100),
      laterPageBodyHeight: body(120),
      splittable: [false, true],
    });
    // 40 을 쓰고 남은 60 이 앞 조각 용량, 뒤 조각은 2페이지 용량 120
    expect(result.splitRequests).toEqual([{ index: 1, firstCapacity: 60, laterCapacity: 120 }]);
  });

  it('쪼갤 수 없는 블록은 요청하지 않는다', () => {
    const result = paginate({
      blockHeights: [40, 80],
      columns: 1,
      firstPageBodyHeight: body(100),
      laterPageBodyHeight: body(120),
    });
    expect(result.splitRequests).toEqual([]);
  });

  it('다 들어가면 요청이 없다', () => {
    const result = paginate({
      blockHeights: [40, 40],
      columns: 1,
      firstPageBodyHeight: body(100),
      laterPageBodyHeight: body(100),
      splittable: [true, true],
    });
    expect(result.splitRequests).toEqual([]);
  });

  it('2단에서는 어느 칸에 놓여도 맞도록 작은 쪽 용량을 준다', () => {
    const result = paginate({
      blockHeights: [200],
      columns: 2,
      firstPageBodyHeight: body(100),
      laterPageBodyHeight: body(150),
      splittable: [true],
    });
    expect(result.splitRequests).toEqual([{ index: 0, firstCapacity: 100, laterCapacity: 100 }]);
  });

  it('한 페이지에도 안 들어가는 표는 축소 대상이면서 분할 요청도 남긴다', () => {
    const result = paginate({
      blockHeights: [500],
      columns: 1,
      firstPageBodyHeight: body(100),
      laterPageBodyHeight: body(100),
      splittable: [true],
    });
    expect(result.oversized).toEqual([0]);
    expect(result.splitRequests).toEqual([{ index: 0, firstCapacity: 100, laterCapacity: 100 }]);
  });

  it('요청은 문서 순서다', () => {
    const result = paginate({
      blockHeights: [80, 80, 80],
      columns: 1,
      firstPageBodyHeight: body(100),
      laterPageBodyHeight: body(100),
      splittable: [true, true, true],
    });
    expect(result.splitRequests.map((request) => request.index)).toEqual([1, 2]);
  });
});

describe('findBlockPage', () => {
  it('블록이 놓인 페이지 번호를 찾는다', () => {
    const { pages } = paginate({
      blockHeights: [40, 40, 40],
      columns: 1,
      firstPageBodyHeight: body(100),
      laterPageBodyHeight: body(100),
    });
    expect(findBlockPage(pages, 0)).toBe(0);
    expect(findBlockPage(pages, 2)).toBe(1);
    expect(findBlockPage(pages, 99)).toBe(-1);
  });
});
