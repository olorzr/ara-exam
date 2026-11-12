import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { SourceSet } from '@/lib/problem-bank/source-sets';

/** 화면이 읽는 주소 — 테스트가 바꿔 끼운다(사이드바 링크로 같은 쪽에 다시 들어온 것처럼) */
let params = new URLSearchParams('year=2025');
vi.mock('next/navigation', () => ({ useSearchParams: () => params }));

const sets: SourceSet[] = [
  { source_type: '내신기출', year: '2026', grade: '중2', semester: '1학기', exam_type: '중간', textbook: '', publisher: '', exam_count: 1, names: ['가중'] },
  { source_type: '내신기출', year: '2025', grade: '중2', semester: '1학기', exam_type: '중간', textbook: '', publisher: '', exam_count: 1, names: ['나중'] },
];
vi.mock('@/hooks/useSourceSets', () => ({
  useSourceSets: () => ({ sets, loading: false, error: null, reload: vi.fn() }),
}));

const { default: ProblemSetsPage } = await import('./page');

/** 카드 링크 수 */
function cardCount(): number {
  return screen.queryAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('/problems/sets/view')).length;
}

describe('기출 세트 목록', () => {
  it('주소의 거르기로 시작한다', () => {
    params = new URLSearchParams('year=2025');
    render(<ProblemSetsPage />);
    expect(cardCount()).toBe(1);
    expect(screen.getByText('나중', { exact: false })).toBeTruthy();
  });

  it('바깥에서 주소가 비면(사이드바로 다시 들어옴) 거르기도 푼다 — 주소와 목록이 어긋나지 않는다', () => {
    params = new URLSearchParams('year=2025');
    const view = render(<ProblemSetsPage />);
    expect(cardCount()).toBe(1);
    params = new URLSearchParams('');
    view.rerender(<ProblemSetsPage />);
    expect(cardCount()).toBe(2);
  });
});
