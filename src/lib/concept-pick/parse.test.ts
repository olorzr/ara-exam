import { describe, it, expect } from 'vitest';
import { CONCEPT_PICK_MAX_COUNT } from './constants';
import { parseConceptPicks } from './parse';

const PLAIN = '이 시의 갈래는 서정시이고 화자는 어머니를 그린다. 수미 상관 구조다.';
const ctx = (over: Partial<Parameters<typeof parseConceptPicks>[1]> = {}) => ({
  plain: PLAIN, existing: [] as string[], ...over,
});
const raw = (picks: unknown[]) => JSON.stringify({ picks });

describe('parseConceptPicks', () => {
  it('본문에 있는 한 어절을 고른다', () => {
    const result = parseConceptPicks(
      raw([{ text: '서정시', reason: '갈래를 묻는 문항이 잦다' }]), ctx(),
    );
    expect(result?.picks).toEqual([{ text: '서정시', reason: '갈래를 묻는 문항이 잦다' }]);
  });

  it('모양이 깨지면 null', () => {
    expect(parseConceptPicks('{', ctx())).toBeNull();
    expect(parseConceptPicks(JSON.stringify({}), ctx())).toBeNull();
  });

  it('본문에 없는 말은 버리고 센다 — 마킹할 자리가 없어 조용히 사라진다', () => {
    const result = parseConceptPicks(raw([{ text: '역설법', reason: 'x' }]), ctx());
    expect(result?.picks).toHaveLength(0);
    expect(result?.dropped.notInText).toBe(1);
  });

  it('공백이 든 말은 버린다 — 빈칸이 두 개가 되어 문항 수와 합격 기준이 어긋난다', () => {
    const result = parseConceptPicks(raw([{ text: '수미 상관', reason: 'x' }]), ctx());
    expect(result?.picks).toHaveLength(0);
    expect(result?.dropped.malformed).toBe(1);
  });

  it('한 글자는 버린다 — 더 긴 낱말 안쪽이 마킹된다', () => {
    const result = parseConceptPicks(raw([{ text: '시', reason: 'x' }]), ctx());
    expect(result?.picks).toHaveLength(0);
    expect(result?.dropped.malformed).toBe(1);
  });

  it('이미 마킹된 용어와 중복 추천을 거른다', () => {
    const result = parseConceptPicks(
      raw([{ text: '갈래', reason: 'x' }, { text: '화자', reason: 'y' }, { text: '화자', reason: 'z' }]),
      ctx({ existing: ['갈래'] }),
    );
    expect(result?.picks.map((p) => p.text)).toEqual(['화자']);
    expect(result?.dropped.duplicate).toBe(2);
  });

  it('상한을 넘는 추천은 잘라 낸다 — 스키마의 maxItems 를 믿지 않는다', () => {
    const words = Array.from({ length: CONCEPT_PICK_MAX_COUNT + 1 }, (_, i) => `용어${i}`);
    const result = parseConceptPicks(
      raw(words.map((text) => ({ text, reason: '' }))),
      ctx({ plain: words.join(' ') }),
    );
    expect(result?.picks).toHaveLength(CONCEPT_PICK_MAX_COUNT);
  });

  it('AI 가 하나도 안 골라도(빈 배열) 모양이 깨진 것이 아니다', () => {
    expect(parseConceptPicks(raw([]), ctx())).toEqual({
      picks: [], dropped: { notInText: 0, duplicate: 0, malformed: 0 },
    });
  });

  it('근거가 없거나 길면 잘라서 받는다 — 용어까지 버리지는 않는다', () => {
    const long = '나'.repeat(300);
    const result = parseConceptPicks(raw([{ text: '화자', reason: long }, { text: '갈래' }]), ctx());
    expect(result?.picks[0].reason.length).toBeLessThanOrEqual(120);
    expect(result?.picks[1]).toEqual({ text: '갈래', reason: '' });
  });
});
