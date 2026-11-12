import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

let params = new URLSearchParams();
vi.mock('next/navigation', () => ({ useSearchParams: () => params }));

let outside: number | null = 0;
vi.mock('@/hooks/useSetSources', () => ({
  useSetSources: () => ({
    rows: [{ id: 's1', source_type: '모의고사', title: '2027 6월 모평 (공통)', school_name: '', problem_count: 45 }],
    outside, loading: false, error: null, reload: vi.fn(),
  }),
}));

const { default: ProblemSetViewPage } = await import('./page');

/** 아카이브 링크가 있는가 */
function archiveLink(): HTMLElement | null {
  return screen.queryByText('이 세트 문항을 문제 아카이브에서 모아 보기');
}

describe('세트 한 장', () => {
  const kice = 'type=모의고사&year=2027&grade=고3&exam=6월 모평&board=평가원';

  it('같은 범위에 다른 세트가 없으면 아카이브 링크를 낸다', () => {
    params = new URLSearchParams(kice);
    outside = 0;
    render(<ProblemSetViewPage />);
    expect(archiveLink()).toBeTruthy();
  });

  it('같은 범위에 주관이 다른 출처가 섞여 있으면 숨긴다 — 아카이브에는 주관 칸이 없다', () => {
    params = new URLSearchParams(kice);
    outside = 1;
    render(<ProblemSetViewPage />);
    expect(archiveLink()).toBeNull();
  });

  it('다 읽기 전에도 내지 않는다', () => {
    params = new URLSearchParams(kice);
    outside = null;
    render(<ProblemSetViewPage />);
    expect(archiveLink()).toBeNull();
  });

  it('교과서가 빈 내신 세트는 숨긴다', () => {
    params = new URLSearchParams('type=내신기출&year=2026&grade=중3&sem=1학기&exam=중간&book=');
    outside = 0;
    render(<ProblemSetViewPage />);
    expect(archiveLink()).toBeNull();
  });

  it('세트 유형이 아닌 주소는 목록으로 돌려보낸다', () => {
    params = new URLSearchParams('type=평가문제집');
    render(<ProblemSetViewPage />);
    expect(screen.getByText('세트를 찾지 못했어요. 주소가 잘렸을 수 있어요.')).toBeTruthy();
  });
});
