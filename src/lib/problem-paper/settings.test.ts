import { describe, it, expect } from 'vitest';
import { DEFAULT_PAPER_SETTINGS, normalizePaperSettings, suggestsSingleColumn } from './settings';

describe('normalizePaperSettings', () => {
  it('기본값은 2단·출처 표시 (배점은 인쇄하지 않는다)', () => {
    expect(DEFAULT_PAPER_SETTINGS).toEqual({ columns: 2, showScore: false, showSource: true, omr: false });
  });

  it('저장값을 그대로 읽는다', () => {
    expect(normalizePaperSettings({ columns: 1, showScore: true, showSource: true, omr: true }))
      .toEqual({ columns: 1, showScore: true, showSource: true, omr: true });
  });

  /**
   * 기본이 '표시' 로 바뀌기 전에 만든 문제지는 `showSource: false` 로 저장돼 있다 —
   * 기본값으로 덮으면 출처 없이 인쇄하기로 한 옛 문제지에 출처가 갑자기 찍힌다.
   */
  it('출처를 끄고 만든 옛 문제지는 그대로 꺼진 채로 읽는다', () => {
    expect(normalizePaperSettings({ columns: 2, showSource: false }).showSource).toBe(false);
  });

  it('출처 값이 없거나 불리언이 아니면 기본(표시)으로 채운다', () => {
    expect(normalizePaperSettings({ columns: 2 }).showSource).toBe(true);
    expect(normalizePaperSettings({ columns: 2, showSource: 'yes' }).showSource).toBe(true);
  });

  // sql/54 의 `jsonb_typeof(...) = 'boolean'` 과 같은 계약 — 불리언 true 만 켠다
  it.each([
    ['키 없음(옛 문제지)', {}, false],
    ['불리언 true', { omr: true }, true],
    ['문자열 "true"', { omr: 'true' }, false],
    ['숫자 1', { omr: 1 }, false],
  ])('OMR 채점: %s → %s', (_label, raw, want) => {
    expect(normalizePaperSettings({ columns: 2, ...raw }).omr).toBe(want);
  });

  it('모양을 믿지 않는다 — jsonb 에 뭐가 들었든 기본값으로 채운다', () => {
    expect(normalizePaperSettings(null)).toEqual(DEFAULT_PAPER_SETTINGS);
    expect(normalizePaperSettings('2단')).toEqual(DEFAULT_PAPER_SETTINGS);
    expect(normalizePaperSettings([])).toEqual(DEFAULT_PAPER_SETTINGS);
    expect(normalizePaperSettings({ columns: 7 })).toEqual(DEFAULT_PAPER_SETTINGS);
  });
});

describe('suggestsSingleColumn', () => {
  it('지문이 길면 1단을 권한다', () => {
    expect(suggestsSingleColumn(1500)).toBe(true);
  });

  it('짧으면 2단 그대로', () => {
    expect(suggestsSingleColumn(300)).toBe(false);
  });
});
