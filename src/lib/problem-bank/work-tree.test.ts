import { describe, it, expect } from 'vitest';
import { EMPTY_FILTERS } from './filters';
import type { WorkFacet } from './facets';
import { buildWorkTree, workFilterPatch, workKey } from './work-tree';

function work(over: Partial<WorkFacet> = {}): WorkFacet {
  return { title: '동백꽃', author: '김유정', count: 3, ...over };
}

/** 트리의 라벨만 뽑아 본다 */
const labels = (nodes: { label: string }[]) => nodes.map((n) => n.label);

describe('buildWorkTree', () => {
  it('지은이 › 작품 두 단계로 묶는다', () => {
    const tree = buildWorkTree([work()]);
    expect(labels(tree)).toEqual(['김유정']);
    expect(labels(tree[0].children)).toEqual(['동백꽃 (3)']);
  });

  it('한 작가의 작품을 한 폴더에 모은다', () => {
    const tree = buildWorkTree([work({ title: '동백꽃' }), work({ title: '봄봄', count: 5 })]);
    expect(tree).toHaveLength(1);
    expect(labels(tree[0].children)).toEqual(['동백꽃 (3)', '봄봄 (5)']);
  });

  it('지은이는 한글 사전순, 모르는 것은 맨 뒤', () => {
    const tree = buildWorkTree([
      work({ title: '제목만', author: '' }),
      work({ title: '메밀꽃 필 무렵', author: '이효석' }),
      work({ title: '동백꽃', author: '김유정' }),
    ]);
    expect(labels(tree)).toEqual(['김유정', '이효석', '지은이 미입력']);
  });

  it('같은 작품이 여러 번 와도 잎은 하나다 — 첫 값을 남긴다', () => {
    const tree = buildWorkTree([work(), work({ count: 99 })]);
    expect(tree[0].children).toHaveLength(1);
    expect(labels(tree[0].children)).toEqual(['동백꽃 (3)']);
  });

  it('제목이 빈 작품은 버린다', () => {
    expect(buildWorkTree([work({ title: '' })])).toEqual([]);
  });

  it('빈 입력이면 빈 트리', () => {
    expect(buildWorkTree([])).toEqual([]);
  });

  it('잎은 고른 작품을 그대로 들고 있다', () => {
    const one = work();
    const leaf = buildWorkTree([one])[0].children[0];
    expect(leaf.value).toEqual(one);
    expect(leaf.id).toBe(workKey(one));
  });

  it('이름에 구분자가 들어가도 키가 섞이지 않는다 — 작품명은 자유 텍스트다', () => {
    expect(workKey({ title: 'a|b' })).not.toBe(workKey({ title: 'a', author: 'b' } as WorkFacet));
  });
});

describe('workFilterPatch', () => {
  it('작품을 걸고 학교·교과서·단원·문법을 비운다 — 네 트리가 조용히 교집합이 되면 안 된다', () => {
    const patch = workFilterPatch(work());
    expect(patch.work_title).toBe('동백꽃');
    expect(patch.school_name).toBe('');
    expect(patch.source_type).toBe('');
    expect(patch.textbook).toBe('');
    expect(patch.unit_path).toEqual([]);
    expect(patch.grammar_path).toEqual([]);
    expect(patch.page).toBe(0);
  });

  it('필터에 얹으면 작품 조건만 남는다', () => {
    const next = { ...EMPTY_FILTERS, school_name: '상현중', unit_path: ['1. 문학'], ...workFilterPatch(work()) };
    expect(next.school_name).toBe('');
    expect(next.unit_path).toEqual([]);
    expect(next.work_title).toBe('동백꽃');
  });
});
