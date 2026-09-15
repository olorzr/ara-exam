import { describe, it, expect } from 'vitest';
import { MATCH_MIN_SCORE } from './constants';
import { matchReason, rankReferenceCandidates } from './match';
import type { CandidateHit, MatchSignal, QuizReferenceKind } from './types';

const hit = (
  key: string, signal: MatchSignal, over: { kind?: QuizReferenceKind; updatedAt?: string; label?: string } = {},
): CandidateHit => ({
  candidate: {
    key,
    kind: over.kind ?? 'sheet',
    id: key.split(':')[1] ?? key,
    label: over.label ?? `개념지 · ${key}`,
    subtitle: '',
    updatedAt: over.updatedAt ?? '2026-09-01T00:00:00Z',
  },
  hit: { signal, detail: `${signal} 맞음` },
});

const rank = (hits: CandidateHit[], over: Partial<Parameters<typeof rankReferenceCandidates>[1]> = {}) =>
  rankReferenceCandidates(hits, {
    dismissed: new Set(), attached: new Set(), limit: 3, ...over,
  });

describe('rankReferenceCandidates', () => {
  it('여러 신호에 걸린 자료가 앞선다', () => {
    const out = rank([
      hit('sheet:a', 'title'),
      hit('sheet:a', 'unit'),
      hit('sheet:b', 'title'),
    ]);
    expect(out.map((r) => r.key)).toEqual(['sheet:a', 'sheet:b']);
  });

  it('같은 신호가 두 번 와도 한 번만 센다 — 쿼리가 둘이어도 제목이 맞은 건 한 번이다', () => {
    const twice = rank([hit('sheet:a', 'title'), hit('sheet:a', 'title')]);
    const once = rank([hit('sheet:b', 'title')]);
    expect(twice[0].score).toBe(once[0].score);
  });

  it('약한 신호 하나뿐이면 자동으로 붙이지 않는다 — 상관없는 자료가 끼면 안 된다', () => {
    expect(rank([hit('passage:a', 'body', { kind: 'passage' })])).toEqual([]);
    expect(rank([hit('passage:a', 'author', { kind: 'passage' })])).toEqual([]);
    // 문턱은 상수 하나가 정한다
    expect(MATCH_MIN_SCORE).toBeGreaterThan(2);
  });

  it('⚠️ 종류 덤이 문턱을 넘겨 주지 않는다 — 지은이만 같은 전문이 끼면 다른 작품이 근거가 된다', () => {
    // 덤까지 더해 견주면 전문(지은이 2 + 덤 1 = 3)과 개념지(본문 2 + 덤 1 = 3)가 통과한다
    expect(rank([hit('text:a', 'author', { kind: 'text' })])).toEqual([]);
    expect(rank([hit('sheet:a', 'body', { kind: 'sheet' })])).toEqual([]);
  });

  it('약한 신호라도 둘이면 붙인다 — 지은이도 같고 본문에도 나오면 우연이 아니다', () => {
    const out = rank([
      hit('text:a', 'author', { kind: 'text' }), hit('text:a', 'body', { kind: 'text' }),
    ]);
    expect(out).toHaveLength(1);
    // 덤은 줄 세울 때만 쓴다 — 점수에는 그대로 실린다
    expect(out[0].score).toBe(2 + 2 + 1);
  });

  it('학교가 같으면 그것 하나로도 붙인다 — 같은 시험 범위라는 뜻이다', () => {
    expect(rank([hit('sheet:a', 'school')])).toHaveLength(1);
  });

  it('가르치려고 만든 자료(개념지·전문)가 같은 점수에서 앞선다', () => {
    const out = rank([
      hit('passage:a', 'title', { kind: 'passage' }),
      hit('sheet:b', 'title', { kind: 'sheet' }),
      hit('text:c', 'title', { kind: 'text' }),
    ]);
    expect(out[out.length - 1].key).toBe('passage:a');
  });

  it('사람이 뺐거나 이미 붙은 자료는 다시 고르지 않는다', () => {
    const hits = [hit('sheet:a', 'title'), hit('sheet:b', 'title'), hit('sheet:c', 'title')];
    const out = rank(hits, { dismissed: new Set(['sheet:a']), attached: new Set(['sheet:b']) });
    expect(out.map((r) => r.key)).toEqual(['sheet:c']);
  });

  it('점수가 같으면 최근에 고친 것이 앞선다', () => {
    const out = rank([
      hit('sheet:old', 'title', { updatedAt: '2026-01-01T00:00:00Z' }),
      hit('sheet:new', 'title', { updatedAt: '2026-09-10T00:00:00Z' }),
    ]);
    expect(out[0].key).toBe('sheet:new');
  });

  it('개수 상한을 지키고, 0 이면 아무것도 고르지 않는다', () => {
    const many = ['a', 'b', 'c', 'd'].map((k) => hit(`sheet:${k}`, 'title'));
    expect(rank(many, { limit: 2 })).toHaveLength(2);
    expect(rank(many, { limit: 0 })).toEqual([]);
    expect(rank(many, { limit: -1 })).toEqual([]);
  });

  it('왜 골랐는지 함께 돌려준다 — 자동으로 붙이려면 반드시 밝힌다', () => {
    const out = rank([hit('sheet:a', 'title'), hit('sheet:a', 'school')]);
    expect(out[0].reason).toBe('title 맞음 · school 맞음');
  });
});

describe('matchReason', () => {
  it('강한 신호부터 적고 같은 신호는 한 번만 적는다', () => {
    expect(matchReason([
      { signal: 'body', detail: '본문에 나와요' },
      { signal: 'title', detail: "제목에 '봄봄'" },
      { signal: 'title', detail: "제목에 '봄봄' (둘째)" },
    ])).toBe("제목에 '봄봄' · 본문에 나와요");
  });

  it('맞은 신호가 없으면 빈 문자열', () => {
    expect(matchReason([])).toBe('');
  });
});
