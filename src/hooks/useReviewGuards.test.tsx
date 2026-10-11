import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useReviewGuards } from './useReviewGuards';
import type { useProblemReview } from './useProblemReview';
import type { Passage, Problem } from '@/types/problem-bank';

type Review = ReturnType<typeof useProblemReview>;

const PASSAGE = {
  id: 'p1', works: [{ label: '가', title: '서시', author: '윤동주' }], area_path: ['문학', '운문 문학'],
} as Passage;
const CHILD = { id: 'q1', passage_id: 'p1' } as Problem;

function setup(dirty: string[]) {
  const savePassage = vi.fn(async () => true);
  const review = {
    passages: [PASSAGE], problems: [CHILD], savePassage,
    removePassage: vi.fn(), mergePassageInto: vi.fn(),
  } as unknown as Review;
  const { result } = renderHook(() => useReviewGuards(review, new Set(dirty)));
  return { guards: result.current, savePassage };
}

afterEach(() => vi.restoreAllMocks());

describe('useReviewGuards — 지문 저장', () => {
  it('대영역을 바꾸면 딸린 문항의 저장하지 않은 수정을 지우기 전에 묻는다', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { guards, savePassage } = setup(['q1']);
    expect(await guards.savePassage('p1', { area_path: ['화법과 언어', '언어'] })).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
    expect(savePassage).not.toHaveBeenCalled();
  });

  it('작품명을 바꿔도 묻는다', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { guards, savePassage } = setup(['q1']);
    await guards.savePassage('p1', { works: [{ label: '가', title: '광야', author: '이육사' }] });
    expect(confirm).toHaveBeenCalledOnce();
    expect(savePassage).toHaveBeenCalledOnce();
  });

  it('소영역·본문만 바꾸거나 고치던 문항이 없으면 묻지 않는다', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    await setup(['q1']).guards.savePassage('p1', { area_path: ['문학', '산문 문학'], html: '<p>x</p>' });
    await setup([]).guards.savePassage('p1', { area_path: ['화법과 언어'] });
    expect(confirm).not.toHaveBeenCalled();
  });
});
