import { describe, expect, it } from 'vitest';
import type { PrintQaItem } from '@/types/print-scan';
import { PRINT_QA_BUNDLE_LIMIT } from './constants';
import { printQaSourceHash } from './source-hash';
import { isQaStale, looksLikeQaPrint, qaAnswerCounts, qaChip, qaReferenceBlocker } from './summary';

const item = (over: Partial<PrintQaItem> = {}): PrintQaItem => ({
  id: 'a', label: '1', lead: '', question: '물음', answer: '', answerSource: 'none',
  studentAnswer: '', evidence: '', evidenceSource: null, verified: true, leadApproved: false, ...over,
});

describe('looksLikeQaPrint', () => {
  it("'답:' 이 두 번 이상이면 문답 프린트로 권한다", () => {
    expect(looksLikeQaPrint('1. 물음 답: 가\n2. 물음 답: 나')).toBe(true);
    expect(looksLikeQaPrint('1. 물음 답 : 가\n2. 물음 답： 나')).toBe(true);
  });

  it('한 번뿐이거나 없으면 권하지 않는다 — 힌트일 뿐 기능을 막지 않는다', () => {
    expect(looksLikeQaPrint('시 한 편입니다. 답: 하나')).toBe(false);
    expect(looksLikeQaPrint('설명만 있는 프린트')).toBe(false);
  });
});

describe('isQaStale', () => {
  const hash = printQaSourceHash('<p>원문</p>');

  it('나눌 때 본 원문과 지금 원문이 다르면 알린다', () => {
    const bundle = { qa_items: [item()], qa_meta: { sourceHash: printQaSourceHash('<p>옛 원문</p>') } };
    expect(isQaStale(bundle, hash)).toBe(true);
  });

  it('같으면 조용하다', () => {
    expect(isQaStale({ qa_items: [item()], qa_meta: { sourceHash: hash } }, hash)).toBe(false);
  });

  it('아직 안 나눴거나 해시가 없으면 알리지 않는다', () => {
    expect(isQaStale({ qa_items: [], qa_meta: { sourceHash: 'x' } }, hash)).toBe(false);
    expect(isQaStale({ qa_items: [item()], qa_meta: {} }, hash)).toBe(false);
  });
});

describe('printQaSourceHash', () => {
  it('같은 글은 같은 값, 한 글자만 달라도 다른 값', () => {
    expect(printQaSourceHash('가나다')).toBe(printQaSourceHash('가나다'));
    expect(printQaSourceHash('가나다')).not.toBe(printQaSourceHash('가나라'));
    expect(printQaSourceHash('')).toHaveLength(8);
  });
});

describe('qaAnswerCounts', () => {
  it('출처별로 세고 확인할 것도 함께 센다', () => {
    const counts = qaAnswerCounts([
      item({ id: 'a', answerSource: 'printed' }),
      item({ id: 'b', answerSource: 'handwritten', verified: false }),
      item({ id: 'c', answerSource: 'ai', evidenceSource: null }),
      item({ id: 'd', answerSource: 'ai', evidenceSource: '' }),
      item({ id: 'e', answerSource: 'none' }),
    ]);
    expect(counts).toMatchObject({
      total: 5, printed: 1, handwritten: 1, ai: 2, none: 1, unverified: 1, withoutEvidence: 1,
    });
  });
});

describe('qaChip', () => {
  it('한 번도 안 나눴으면 칩이 없다', () => {
    expect(qaChip([], {})).toBeNull();
    expect(qaChip(null, null)).toBeNull();
  });

  it('실패는 문항이 없어도 알린다', () => {
    expect(qaChip([], { status: 'failed', warnings: ['까닭'] })).toMatchObject({
      label: '문답 실패', tone: 'error',
    });
  });

  it('손볼 것이 남아 있으면 흐린 색으로 — 다 채워졌으면 ok', () => {
    expect(qaChip([item({ answerSource: 'none' })], { status: 'done' })?.tone).toBe('muted');
    expect(qaChip([item({ answerSource: 'printed' })], { status: 'done' })?.tone).toBe('ok');
  });
});

describe('qaReferenceBlocker', () => {
  const state = { referenceChars: 0, loading: false, searching: false };

  it('⚠️ 찾는 중·불러오는 중에는 막는다 — 자료 없이 만들어지면 사람은 붙은 것을 썼다고 여긴다', () => {
    expect(qaReferenceBlocker(100, { ...state, searching: true })).toContain('찾는 중');
    expect(qaReferenceBlocker(100, { ...state, loading: true })).toContain('불러오는 중');
  });

  it('합이 상한을 넘으면 빼라고 말한다', () => {
    expect(qaReferenceBlocker(PRINT_QA_BUNDLE_LIMIT, { ...state, referenceChars: 1 }))
      .toContain('참고자료를 빼');
  });

  it('괜찮으면 null', () => {
    expect(qaReferenceBlocker(100, state)).toBeNull();
  });
});
