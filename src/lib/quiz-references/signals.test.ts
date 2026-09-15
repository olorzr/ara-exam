import { describe, it, expect } from 'vitest';
import { hasMatchSignals, signalsFromDraft, signalsKey } from './signals';
import type { PickedPassageMeta } from './types';

const picked: PickedPassageMeta = {
  id: 'p1', unitPath: ['1. 문학의 갈래', '(1) 소설'], textbook: '천재(정호웅)',
  grade: '중2', schoolName: '상현중', year: '2026',
};

describe('signalsFromDraft', () => {
  it('감싼 기호를 벗긴다 — DB 에는 「」 없이 저장돼 있다', () => {
    expect(signalsFromDraft({ title: '「봄봄」', author: ' 김유정 ' }, null).title).toBe('봄봄');
    expect(signalsFromDraft({ title: '「봄봄」', author: ' 김유정 ' }, null).author).toBe('김유정');
  });

  it('한 글자 제목은 신호로 쓰지 않는다 — 그 글자가 든 자료가 전부 걸려 온다', () => {
    expect(signalsFromDraft({ title: '봄', author: '' }, null).title).toBe('');
    expect(signalsFromDraft({ title: '봄봄', author: '' }, null).title).toBe('봄봄');
  });

  it('붙여넣기면 단원·학교 신호가 없다', () => {
    const s = signalsFromDraft({ title: '봄봄', author: '' }, null);
    expect(s.unitPath).toEqual([]);
    expect(s.excludePassageId).toBeNull();
    expect(s.textbook).toBe('');
  });

  it('아카이브에서 고른 지문은 단원·학교까지 들고 오고 자기 자신을 뺀다', () => {
    const s = signalsFromDraft({ title: '봄봄', author: '' }, picked);
    expect(s.unitPath).toEqual(['1. 문학의 갈래', '(1) 소설']);
    expect(s.textbook).toBe('천재(정호웅)');
    expect(s.excludePassageId).toBe('p1');
  });
});

describe('hasMatchSignals', () => {
  it('아무 신호도 없으면 찾으러 가지 않는다 — 최근 자료를 아무거나 붙이면 안 된다', () => {
    expect(hasMatchSignals(signalsFromDraft({ title: '', author: '' }, null))).toBe(false);
    expect(hasMatchSignals(signalsFromDraft({ title: '봄', author: '' }, null))).toBe(false);
  });

  it('제목·지은이·단원·학교 가운데 하나만 있어도 찾는다', () => {
    expect(hasMatchSignals(signalsFromDraft({ title: '봄봄', author: '' }, null))).toBe(true);
    expect(hasMatchSignals(signalsFromDraft({ title: '', author: '김유정' }, null))).toBe(true);
    expect(hasMatchSignals(signalsFromDraft({ title: '', author: '' }, picked))).toBe(true);
  });

  it('교과서만 있고 단원이 없으면 단원 신호로 치지 않는다', () => {
    const onlyTextbook = { ...picked, unitPath: [], schoolName: '' };
    expect(hasMatchSignals(signalsFromDraft({ title: '', author: '' }, onlyTextbook))).toBe(false);
  });
});

describe('signalsKey', () => {
  it('같은 신호면 같은 열쇠다 — 그래야 두 번 찾지 않는다', () => {
    const a = signalsFromDraft({ title: '봄봄', author: '김유정' }, picked);
    const b = signalsFromDraft({ title: '봄봄', author: '김유정' }, picked);
    expect(signalsKey(a)).toBe(signalsKey(b));
  });

  it('하나라도 다르면 열쇠가 갈린다', () => {
    const a = signalsFromDraft({ title: '봄봄', author: '' }, null);
    const b = signalsFromDraft({ title: '동백꽃', author: '' }, null);
    expect(signalsKey(a)).not.toBe(signalsKey(b));
  });
});
