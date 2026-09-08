import { describe, it, expect } from 'vitest';
import { batchPlanSummary, planPageBatches } from './batch-plan';

describe('planPageBatches', () => {
  it('기본값(3쪽·겹침1)으로 나눈다', () => {
    expect(planPageBatches([1, 2, 3, 4, 5])).toEqual([[1, 2, 3], [3, 4, 5]]);
  });

  it('겹침이 있어 경계를 넘는 지문이 한 묶음에 온전히 들어온다', () => {
    const batches = planPageBatches([1, 2, 3, 4, 5, 6, 7]);
    // 3-4 경계에 걸친 지문은 [3,4,5] 안에 통째로 있다
    expect(batches.some((b) => b.includes(3) && b.includes(4))).toBe(true);
    // 5-6 경계도 마찬가지
    expect(batches.some((b) => b.includes(5) && b.includes(6))).toBe(true);
  });

  it('쪽이 하나면 묶음도 하나', () => {
    expect(planPageBatches([7])).toEqual([[7]]);
  });

  it('빈 입력이면 빈 배열', () => {
    expect(planPageBatches([])).toEqual([]);
  });

  it('중복·역순 입력을 정리한다', () => {
    expect(planPageBatches([3, 1, 2, 1], { size: 3, overlap: 0 })).toEqual([[1, 2, 3]]);
  });

  it('연속되지 않은 쪽도 순서대로 묶는다 (문제 쪽만 골랐을 때)', () => {
    expect(planPageBatches([2, 5, 9, 12], { size: 2, overlap: 0 })).toEqual([[2, 5], [9, 12]]);
  });

  it('겹침 0 이면 딱 나눈다', () => {
    expect(planPageBatches([1, 2, 3, 4], { size: 2, overlap: 0 })).toEqual([[1, 2], [3, 4]]);
  });

  it('겹침이 묶음 크기 이상이면 가둔다 — 안 그러면 진행이 안 된다', () => {
    const batches = planPageBatches([1, 2, 3, 4, 5], { size: 2, overlap: 5 });
    expect(batches.length).toBeGreaterThan(0);
    expect(batches.length).toBeLessThan(10);
    expect(batches.flat()).toContain(5);
  });

  it('앞 묶음에 이미 다 들어간 꼬리 묶음은 만들지 않는다 — ChatGPT 한 번 낭비', () => {
    // [1,2,3] 다음 stride 2 → [3,4] 로 끝. [4] 만 남는 묶음이 생기면 안 된다
    const batches = planPageBatches([1, 2, 3, 4]);
    expect(batches).toEqual([[1, 2, 3], [3, 4]]);
  });

  it('모든 쪽이 최소 한 묶음에는 들어간다', () => {
    const pages = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const covered = new Set(planPageBatches(pages).flat());
    expect([...covered].sort((a, b) => a - b)).toEqual(pages);
  });
});

describe('batchPlanSummary', () => {
  it('겹친 쪽을 한 번만 센다', () => {
    expect(batchPlanSummary([[1, 2, 3], [3, 4, 5]])).toBe('5쪽을 2묶음으로 읽어요');
  });
});
