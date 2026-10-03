import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const fetchReferenceTextFacets = vi.fn();

vi.mock('@/lib/reference-texts/facets', () => ({
  fetchReferenceTextFacets: (...a: unknown[]) => fetchReferenceTextFacets(...a),
}));

const { useReferenceTextFacets } = await import('./useReferenceTextFacets');

const unit = { grade: '중2', textbook: '천재(노미숙)', semester: '1학기', unit_path: ['1. 문학'] };
const row = (id: string, title: string) => ({
  id, title, author: '김유정', units: [unit], grammar_paths: [] as string[],
});

beforeEach(() => {
  fetchReferenceTextFacets.mockReset().mockResolvedValue([row('a', '봄봄')]);
});

describe('useReferenceTextFacets', () => {
  it('한 번 읽어 트리를 만든다', async () => {
    const { result } = renderHook(() => useReferenceTextFacets());
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(fetchReferenceTextFacets).toHaveBeenCalledTimes(1);
    expect(result.current.unitTree[0].label).toBe('중2 (1)');
    // 문법은 마스터 전체를 그리고, 분류 없는 전문이 있으면 맨 끝에 잎이 붙는다
    const last = result.current.grammarTree[result.current.grammarTree.length - 1];
    expect(last.label).toBe('분류 없음 (1)');
  });

  it('다시 읽기를 부르면 새로 읽는다 — 지운 작품이 트리에 남지 않게', async () => {
    const { result } = renderHook(() => useReferenceTextFacets());
    await waitFor(() => expect(result.current.rows).toHaveLength(1));

    fetchReferenceTextFacets.mockResolvedValue([]);
    act(() => result.current.reload());

    await waitFor(() => expect(result.current.rows).toHaveLength(0));
    expect(fetchReferenceTextFacets).toHaveBeenCalledTimes(2);
  });

  it('⚠️ 다시 읽다 실패하면 이전 트리를 남긴다 — 통째로 비우지 않는다', async () => {
    const { result } = renderHook(() => useReferenceTextFacets());
    await waitFor(() => expect(result.current.rows).toHaveLength(1));

    fetchReferenceTextFacets.mockRejectedValue(new Error('네트워크'));
    act(() => result.current.reload());

    await waitFor(() => expect(fetchReferenceTextFacets).toHaveBeenCalledTimes(2));
    expect(result.current.rows).toHaveLength(1);
  });
});
