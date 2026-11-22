import { beforeEach, describe, expect, it } from 'vitest';
import { examSheetHref, rememberExamSheetQuery, resetExamSheetQueries } from './exam-sheet-tabs';

const STORAGE_KEY = 'ara-exam-sheet-query';

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
    // 저장소 값만 남은 상태(새로 고친 뒤)를 흉내 — 이상한 값은 버린다
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ sets: '?kind=mock', sources: 'javascript:x' }));
    expect(examSheetHref('sets')).toBe('/problems/sets?kind=mock');
    expect(examSheetHref('sources')).toBe('/problems/sources');
    window.sessionStorage.setItem(STORAGE_KEY, '{망가진');
    expect(examSheetHref('sets')).toBe('/problems/sets?year=2025');
  });
});
