import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { EMPTY_FILTERS, type ProblemFilters } from '@/lib/problem-bank/filters';
import type { Category } from '@/types';

const unit: Category = {
  id: 'cat-1', level: '중등', year: '', grade: '중2', publisher: '천재(박영목)',
  semester: '1학기', chapter: '1. 문학', sub_chapter: '(1) 시', user_id: 'u', created_at: '',
};

vi.mock('@/lib/category-master', () => ({
  getAllSelectableCategories: async () => [unit],
}));

const { default: UnitTreePanel } = await import('./UnitTreePanel');

/** 접혀 있으면 펼치고, 잎이면 누른다 */
async function open(label: string) {
  const node = (await screen.findByText(label)).closest('[role="button"]')!;
  if (node.getAttribute('aria-expanded') !== 'true') fireEvent.click(node);
}

describe('UnitTreePanel', () => {
  /**
   * 단원 잎은 학년을 그 단원의 학년으로 못 박는다. 학교급을 남기면
   * '고등 ∩ 중2' 가 조용히 0건이 된다(코덱스 정지 리뷰).
   */
  it('단원을 고르면 학년을 정하고 학교급은 푼다', async () => {
    const onChange = vi.fn<(patch: Partial<ProblemFilters>) => void>();
    render(<UnitTreePanel filters={{ ...EMPTY_FILTERS, school_level: '고등' }} onChange={onChange} />);

    for (const label of ['중등', '중2', '천재(박영목)', '1학기', '1. 문학', '(1) 시']) {
      await open(label);
    }

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatchObject({
      grade: '중2', school_level: '', textbook: '천재(박영목)', unit_path: ['1. 문학', '(1) 시'],
    });
  });
});
