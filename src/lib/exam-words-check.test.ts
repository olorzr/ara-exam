import { describe, expect, it } from 'vitest';
import { checkExamWords, examWordsIssueMessage } from './exam-words-check';

const rows = (...idx: number[]) => idx.map((order_index) => ({ order_index }));

describe('checkExamWords', () => {
  it('개수와 순서가 맞으면 문제없다', () => {
    expect(checkExamWords(3, rows(0, 1, 2))).toBeNull();
  });

  it('⚠️ 메타보다 적게 읽었으면 개수 불일치다', () => {
    expect(checkExamWords(20, rows(0, 1, 2))).toEqual({ kind: 'count', expected: 20, actual: 3 });
  });

  it('⚠️ 하나도 못 읽었으면(빈 목록) 정상 0건이 아니라 개수 불일치다', () => {
    expect(checkExamWords(20, [])).toEqual({ kind: 'count', expected: 20, actual: 0 });
  });

  it('순서 번호가 비거나 겹치면 순서 문제다', () => {
    expect(checkExamWords(3, rows(0, 2, 3))).toEqual({ kind: 'order' });
    expect(checkExamWords(3, rows(0, 1, 1))).toEqual({ kind: 'order' });
  });

  it('안내 문장에 개수를 적는다', () => {
    expect(examWordsIssueMessage({ kind: 'count', expected: 20, actual: 19 })).toContain('20개 중 19개');
    expect(examWordsIssueMessage({ kind: 'failed' })).toContain('불러오지 못했어요');
  });
});
