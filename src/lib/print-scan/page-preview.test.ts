import { describe, it, expect } from 'vitest';
import { neighborPages, pageRange } from './page-preview';

describe('pageRange', () => {
  it('1부터 전체 쪽까지 센다', () => {
    expect(pageRange(3)).toEqual([1, 2, 3]);
  });

  it('아직 PDF 를 안 열었으면 빈 목록이다', () => {
    expect(pageRange(0)).toEqual([]);
  });
});

describe('neighborPages', () => {
  it('띄엄띄엄한 목록에서도 이웃으로 움직인다 — 묶음이 덮는 쪽은 연속이 아니다', () => {
    expect(neighborPages([2, 5, 7], 5)).toEqual({ prev: 2, next: 7 });
  });

  it('양 끝에서는 그쪽이 없다', () => {
    expect(neighborPages([2, 5, 7], 2).prev).toBeNull();
    expect(neighborPages([2, 5, 7], 7).next).toBeNull();
  });

  it('닫혀 있거나 목록에 없는 쪽이면 아무 데로도 못 간다', () => {
    expect(neighborPages([2, 5, 7], null)).toEqual({ prev: null, next: null });
    expect(neighborPages([2, 5, 7], 3)).toEqual({ prev: null, next: null });
  });
});
