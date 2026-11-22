import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ExamSheetTabs from './ExamSheetTabs';

describe('ExamSheetTabs — 기출 시험지 머리 탭 (2026-11-22)', () => {
  it('제목은 기출 시험지 하나, 지금 화면 탭에 aria-current', () => {
    render(<ExamSheetTabs current="sets">설명</ExamSheetTabs>);
    expect(screen.getByRole('heading', { level: 1, name: '기출 시험지' })).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: '기출 시험지 보기 방식' });
    expect(nav).toBeTruthy();
    // 지금 화면 탭은 링크가 아니다 — 눌러 맨 주소로 가면 보던 조건이 지워진다(코덱스 1R)
    expect(screen.queryByRole('link', { name: '세트로 보기' })).toBeNull();
    expect(screen.getByText('세트로 보기').getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: '목록으로 보기' }).getAttribute('aria-current')).toBeNull();
    expect(screen.getByText('설명')).toBeTruthy();
  });

  it('반대편 탭은 그 화면의 맨 주소로 간다', () => {
    render(<ExamSheetTabs current="sources" />);
    expect(screen.getByRole('link', { name: '세트로 보기' }).getAttribute('href')).toBe('/problems/sets');
    expect(screen.queryByRole('link', { name: '목록으로 보기' })).toBeNull();
  });
});
