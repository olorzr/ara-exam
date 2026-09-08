import { describe, it, expect } from 'vitest';
import { DEFAULT_PAPER_SETTINGS, normalizePaperSettings, suggestsSingleColumn } from './settings';

describe('normalizePaperSettings', () => {
  it('기본값은 2단·출처 숨김 (배점은 인쇄하지 않는다)', () => {
    expect(DEFAULT_PAPER_SETTINGS).toEqual({ columns: 2, showScore: false, showSource: false });
  });

  it('저장값을 그대로 읽는다', () => {
    expect(normalizePaperSettings({ columns: 1, showScore: true, showSource: true }))
      .toEqual({ columns: 1, showScore: true, showSource: true });
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
