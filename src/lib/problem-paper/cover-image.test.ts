import { describe, expect, it } from 'vitest';
import { COVER_MAX_SIDE_PX, fitCoverSize } from './cover-image';

describe('fitCoverSize', () => {
  it('상한 안이면 그대로', () => {
    expect(fitCoverSize(1200, 1700)).toEqual({ width: 1200, height: 1700 });
  });

  it('세로가 길면 세로를 상한에 맞추고 비율을 지킨다', () => {
    const size = fitCoverSize(3508, 4961);
    expect(size.height).toBe(COVER_MAX_SIDE_PX);
    expect(size.width / size.height).toBeCloseTo(3508 / 4961, 3);
  });

  it('가로가 길면 가로를 상한에 맞춘다', () => {
    expect(fitCoverSize(4678, 2339).width).toBe(COVER_MAX_SIDE_PX);
  });
});
