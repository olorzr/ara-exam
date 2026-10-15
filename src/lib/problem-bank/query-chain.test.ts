import { describe, it, expect } from 'vitest';
import { withOrderColumns } from './query-chain';

describe('withOrderColumns — 함수 결과는 select 에 없는 칸으로 정렬하지 못한다', () => {
  it('빠진 정렬 칸만 뒤에 붙인다', () => {
    expect(withOrderColumns('id, passage_id, question_type, source:problem_sources!inner(id)', 'reading'))
      .toBe('id, passage_id, question_type, source:problem_sources!inner(id), source_id, page_no, number');
    expect(withOrderColumns('id', 'recent')).toBe('id, created_at, page_no, number');
  });

  it('임베드 괄호 안의 칸은 최상위 칸으로 치지 않는다', () => {
    expect(withOrderColumns('id, source:problem_sources!inner(id, page_no)', 'recent'))
      .toBe('id, source:problem_sources!inner(id, page_no), created_at, page_no, number');
  });

  it('다 있거나 * 면 그대로 돌려준다', () => {
    const full = 'id, source_id, passage_id, page_no, number, created_at';
    expect(withOrderColumns(full, 'reading')).toBe(full);
    expect(withOrderColumns(full, 'recent')).toBe(full);
    expect(withOrderColumns('*, source:problem_sources!inner(*)', 'reading')).toBe('*, source:problem_sources!inner(*)');
  });
});
