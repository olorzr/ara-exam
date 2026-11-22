import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { rememberExamSheetQuery, resetExamSheetQueries } from '@/lib/problem-bank/exam-sheet-tabs';
import ExamSheetTabs from './ExamSheetTabs';

beforeEach(() => resetExamSheetQueries());

describe('ExamSheetTabs — 기출 시험지 머리 탭 (2026-11-22)', () => {
  it('제목은 기출 시험지 하나, 지금 화면 탭에 aria-current', () => {
    render(<ExamSheetTabs current="sets">설명</ExamSheetTabs>);
    expect(screen.getByRole('heading', { level: 1, name: '기출 시험지' })).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: '기출 시험지 보기 방식' });
    expect(nav).toBeTruthy();
    expect(screen.getByRole('link', { name: '세트로 보기' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: '목록으로 보기' }).getAttribute('aria-current')).toBeNull();
    expect(screen.getByText('설명')).toBeTruthy();
  });

  it('반대편 탭은 그 화면에서 마지막으로 보던 조건으로 간다', () => {
    rememberExamSheetQuery('sources', '?school=압구정중학교');
    rememberExamSheetQuery('sets', '?year=2025');
    render(<ExamSheetTabs current="sets" />);
    expect(screen.getByRole('link', { name: '목록으로 보기' }).getAttribute('href')).toBe('/problems/sources?school=압구정중학교');
    // 지금 화면 탭은 맨 주소(조건은 이미 주소에 있다)
    expect(screen.getByRole('link', { name: '세트로 보기' }).getAttribute('href')).toBe('/problems/sets');
  });
});
