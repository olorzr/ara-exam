import { describe, it, expect } from 'vitest';
import { applyPaperExclusions, hasPaperExclusions, withExclusionEmbed } from './paper-exclusions';

/** 건 조건을 차례대로 적어 두는 빌더 */
function recorder() {
  const calls: unknown[][] = [];
  const chain = {
    calls,
    in(column: string, values: readonly string[]) { calls.push(['in', column, values]); return chain; },
    is(column: string, value: null) { calls.push(['is', column, value]); return chain; },
    neq(column: string, value: string) { calls.push(['neq', column, value]); return chain; },
  };
  return chain;
}

describe('withExclusionEmbed', () => {
  it('뺄 문제지가 있을 때만 임베드를 덧붙인다', () => {
    expect(withExclusionEmbed('id', { exclude_paper_ids: ['p1'] })).toBe('id, problem_paper_items!left(paper_id)');
  });

  it('없으면 글자 그대로다 — 정답 빼기만으로는 임베드가 필요 없다', () => {
    expect(withExclusionEmbed('id', {})).toBe('id');
    expect(withExclusionEmbed('id', { exclude_paper_ids: [] })).toBe('id');
    expect(withExclusionEmbed('id', { answered_only: true })).toBe('id');
  });
});

describe('applyPaperExclusions', () => {
  it('⚠️ 문항을 떨어뜨리는 것은 뒤의 is.null 이다 — in 만 걸면 임베드 행만 빈다', () => {
    expect(applyPaperExclusions(recorder(), { exclude_paper_ids: ['p1', 'p2'] }).calls).toEqual([
      ['in', 'problem_paper_items.paper_id', ['p1', 'p2']],
      ['is', 'problem_paper_items', null],
    ]);
  });

  it("정답 빼기는 answer <> '' 이다", () => {
    expect(applyPaperExclusions(recorder(), { answered_only: true }).calls).toEqual([['neq', 'answer', '']]);
  });

  it('조건이 없으면 아무것도 걸지 않는다', () => {
    expect(applyPaperExclusions(recorder(), {}).calls).toEqual([]);
    expect(applyPaperExclusions(recorder(), { exclude_paper_ids: [], answered_only: false }).calls).toEqual([]);
  });
});

describe('hasPaperExclusions', () => {
  it('하나라도 걸렸으면 참이다', () => {
    expect(hasPaperExclusions({})).toBe(false);
    expect(hasPaperExclusions({ exclude_paper_ids: [] })).toBe(false);
    expect(hasPaperExclusions({ answered_only: true })).toBe(true);
    expect(hasPaperExclusions({ exclude_paper_ids: ['p1'] })).toBe(true);
  });
});
