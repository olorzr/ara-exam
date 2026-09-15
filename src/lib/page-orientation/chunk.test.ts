import { describe, it, expect } from 'vitest';
import { chunkPages } from './chunk';
import { ORIENTATION_PAGES_PER_CALL } from './constants';

describe('chunkPages', () => {
  it('한 turn 의 이미지 상한만큼 나눈다', () => {
    const pages = Array.from({ length: ORIENTATION_PAGES_PER_CALL + 2 }, (_, i) => i + 1);
    const chunks = chunkPages(pages);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(ORIENTATION_PAGES_PER_CALL);
    expect(chunks[1]).toHaveLength(2);
  });

  it('중복을 없애고 오름차순으로 세운다 — 순번이 곧 쪽이라 순서가 계약이다', () => {
    expect(chunkPages([3, 1, 3, 2], 8)).toEqual([[1, 2, 3]]);
  });

  it('쪽 번호가 아닌 값은 버린다', () => {
    expect(chunkPages([0, -1, 1.5, 2], 8)).toEqual([[2]]);
  });

  it('빈 목록은 빈 묶음', () => {
    expect(chunkPages([])).toEqual([]);
  });
});
