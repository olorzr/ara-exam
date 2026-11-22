import { beforeEach, describe, expect, it, vi } from 'vitest';
import { examSheetHref, rememberExamSheetQuery, resetExamSheetQueries } from './exam-sheet-tabs';

const STORAGE_KEY = 'ara-exam-sheet-query';

/** 모듈 기억만 비운다 — 저장소는 그대로(새로 고친 뒤를 흉내) */
function resetMemoryOnly() {
  const saved = window.sessionStorage.getItem(STORAGE_KEY);
  resetExamSheetQueries();
  if (saved !== null) window.sessionStorage.setItem(STORAGE_KEY, saved);
}

beforeEach(() => resetExamSheetQueries());

describe('기출 시험지 탭 — 보던 조건 이어 가기', () => {
  it('처음엔 맨 주소', () => {
    expect(examSheetHref('sets')).toBe('/problems/sets');
    expect(examSheetHref('sources')).toBe('/problems/sources');
  });

  it('화면이 적은 조건을 기억해 그 탭 링크에 붙인다 — 화면끼리 섞이지 않는다', () => {
    rememberExamSheetQuery('sets', '?kind=school&year=2025');
    rememberExamSheetQuery('sources', '?school=압구정중학교');
    expect(examSheetHref('sets')).toBe('/problems/sets?kind=school&year=2025');
    expect(examSheetHref('sources')).toBe('/problems/sources?school=압구정중학교');
  });

  it('조건을 지우면 맨 주소로, 이상한 모양은 버린다', () => {
    rememberExamSheetQuery('sets', '?year=2025');
    rememberExamSheetQuery('sets', '');
    expect(examSheetHref('sets')).toBe('/problems/sets');
    rememberExamSheetQuery('sources', '/evil');
    expect(examSheetHref('sources')).toBe('/problems/sources');
    rememberExamSheetQuery('sources', '?');
    expect(examSheetHref('sources')).toBe('/problems/sources');
  });

  it('기억은 그 탭의 sessionStorage 에도 남는다 — 새로 고쳐(자동 새로 고침 포함) 모듈이 다시 올라와도 산다(코덱스 4R)', () => {
    rememberExamSheetQuery('sets', '?year=2025');
    expect(JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({ sets: '?year=2025', sources: '' });
  });

  it('새로 고친 뒤(이 페이지에서 아직 안 적음)에는 저장소 값을 쓴다 — 이상한 값·망가진 저장은 버린다', () => {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ sets: '?kind=mock', sources: 'javascript:x' }));
    expect(examSheetHref('sets')).toBe('/problems/sets?kind=mock');
    expect(examSheetHref('sources')).toBe('/problems/sources');
    window.sessionStorage.setItem(STORAGE_KEY, '{망가진');
    expect(examSheetHref('sets')).toBe('/problems/sets');
  });

  it('저장소 쓰기가 막혀도 이 페이지에서 마지막으로 적은 조건을 쓴다(코덱스 5R)', () => {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ sets: '?year=2024', sources: '' }));
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    rememberExamSheetQuery('sets', '?year=2026');
    expect(examSheetHref('sets')).toBe('/problems/sets?year=2026');
    rememberExamSheetQuery('sets', '');
    expect(examSheetHref('sets')).toBe('/problems/sets');
    setItem.mockRestore();
  });

  it('망가진 저장 글은 다음 쓰기가 덮어 고친다 — 새로 고쳐도 조건이 산다(코덱스 6R)', () => {
    window.sessionStorage.setItem(STORAGE_KEY, '{망가진');
    rememberExamSheetQuery('sets', '?year=2025');
    expect(JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({ sets: '?year=2025', sources: '' });
    // 새로 고친 뒤(모듈 기억이 빈 상태)를 흉내
    resetMemoryOnly();
    expect(examSheetHref('sets')).toBe('/problems/sets?year=2025');
  });
});
