import { describe, it, expect } from 'vitest';
import { EMPTY_FILTERS } from './filters';
import type { WorkFacet } from './facets';
import {
  buildWorkTree, isWorkTreeOrder, workFilterPatch, workKey, DEFAULT_WORK_TREE_ORDER,
} from './work-tree';

function work(over: Partial<WorkFacet> = {}): WorkFacet {
  return { title: '동백꽃', author: '김유정', count: 3, kind: 'literary', ...over };
}

/** 트리의 라벨만 뽑아 본다 */
const labels = (nodes: { label: string }[]) => nodes.map((n) => n.label);

describe('buildWorkTree', () => {
  it('갈래 › 지은이 › 작품 세 단계로 묶는다', () => {
    const tree = buildWorkTree([work()]);
    expect(labels(tree)).toEqual(['문학']);
    expect(labels(tree[0].children)).toEqual(['김유정']);
    expect(labels(tree[0].children[0].children)).toEqual(['동백꽃 (3)']);
  });

  it('문학과 비문학을 갈라 담고 문학이 먼저다', () => {
    const tree = buildWorkTree([
      work({ title: '거울 뉴런', author: '', kind: 'nonliterary' }),
      work({ title: '동백꽃' }),
    ]);
    expect(labels(tree)).toEqual(['문학', '비문학']);
    expect(labels(tree[0].children[0].children)).toEqual(['동백꽃 (3)']);
    expect(labels(tree[1].children[0].children)).toEqual(['거울 뉴런 (3)']);
  });

  it('작품이 없는 갈래 폴더는 만들지 않는다', () => {
    expect(labels(buildWorkTree([work()]))).toEqual(['문학']);
  });

  it('영역을 모르는 작품은 맨 뒤 폴더로 간다', () => {
    const tree = buildWorkTree([
      work({ title: '알 수 없는 글', kind: 'unknown' }),
      work({ title: '거울 뉴런', kind: 'nonliterary' }),
      work({ title: '동백꽃' }),
    ]);
    expect(labels(tree)).toEqual(['문학', '비문학', '영역 미지정']);
  });

  it('한 작가의 작품을 한 폴더에 모은다', () => {
    const tree = buildWorkTree([work({ title: '동백꽃' }), work({ title: '봄봄', count: 5 })]);
    expect(tree[0].children).toHaveLength(1);
    expect(labels(tree[0].children[0].children)).toEqual(['동백꽃 (3)', '봄봄 (5)']);
  });

  it('지은이는 한글 사전순, 모르는 것은 맨 뒤', () => {
    const tree = buildWorkTree([
      work({ title: '제목만', author: '' }),
      work({ title: '메밀꽃 필 무렵', author: '이효석' }),
      work({ title: '동백꽃', author: '김유정' }),
    ]);
    expect(labels(tree[0].children)).toEqual(['김유정', '이효석', '지은이 미입력']);
  });

  it('같은 지은이가 두 갈래에 걸려도 폴더 키가 겹치지 않는다', () => {
    const tree = buildWorkTree([
      work({ title: '맛있는 책, 일생의 보약', author: '성석제' }),
      work({ title: '학생 글', author: '성석제', kind: 'nonliterary' }),
    ]);
    expect(tree[0].children[0].id).not.toBe(tree[1].children[0].id);
  });

  it('같은 작품이 여러 번 와도 잎은 하나다 — 첫 값을 남긴다', () => {
    const tree = buildWorkTree([work(), work({ count: 99 })]);
    expect(tree[0].children[0].children).toHaveLength(1);
    expect(labels(tree[0].children[0].children)).toEqual(['동백꽃 (3)']);
  });

  it('제목이 빈 작품은 버린다', () => {
    expect(buildWorkTree([work({ title: '' })])).toEqual([]);
  });

  it('빈 입력이면 빈 트리', () => {
    expect(buildWorkTree([])).toEqual([]);
  });

  it('잎은 고른 작품을 그대로 들고 있다', () => {
    const one = work();
    const leaf = buildWorkTree([one])[0].children[0].children[0];
    expect(leaf.value).toEqual(one);
    expect(leaf.id).toBe(workKey(one));
  });

  it('이름에 구분자가 들어가도 키가 섞이지 않는다 — 작품명은 자유 텍스트다', () => {
    expect(workKey({ title: 'a|b' })).not.toBe(workKey({ title: 'a', author: 'b' } as WorkFacet));
  });
});

describe('buildWorkTree — 작품명순', () => {
  it('갈래 아래에 작품을 평면으로 세운다', () => {
    const tree = buildWorkTree([
      work({ title: '봄봄', count: 5 }),
      work({ title: '동백꽃' }),
    ], 'title');
    expect(labels(tree)).toEqual(['문학']);
    expect(labels(tree[0].children)).toEqual(['동백꽃 — 김유정 (3)', '봄봄 — 김유정 (5)']);
  });

  it('지은이를 모르면 제목만 적는다', () => {
    const tree = buildWorkTree([work({ title: '홍길동전', author: '', count: 1 })], 'title');
    expect(labels(tree[0].children)).toEqual(['홍길동전 (1)']);
  });

  it('갈래는 지은이순과 똑같이 가른다', () => {
    const tree = buildWorkTree([
      work({ title: '거울 뉴런', kind: 'nonliterary', count: 1 }),
      work({ title: '동백꽃' }),
    ], 'title');
    expect(labels(tree)).toEqual(['문학', '비문학']);
  });

  it('정렬을 바꿔도 잎의 id 는 그대로다 — 고른 작품의 강조가 풀리면 안 된다', () => {
    const one = work();
    const byAuthor = buildWorkTree([one], 'author')[0].children[0].children[0];
    const byTitle = buildWorkTree([one], 'title')[0].children[0];
    expect(byTitle.id).toBe(byAuthor.id);
    expect(byTitle.value).toEqual(one);
  });

  it('기본 정렬은 지은이순이다 — 이 기능이 생기기 전의 모양', () => {
    expect(DEFAULT_WORK_TREE_ORDER).toBe('author');
    expect(buildWorkTree([work()])).toEqual(buildWorkTree([work()], 'author'));
  });
});

describe('isWorkTreeOrder', () => {
  it('아는 값만 받는다', () => {
    expect(isWorkTreeOrder('author')).toBe(true);
    expect(isWorkTreeOrder('title')).toBe(true);
    expect(isWorkTreeOrder('')).toBe(false);
    expect(isWorkTreeOrder('count')).toBe(false);
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
