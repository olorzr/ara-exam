import { describe, expect, it } from 'vitest';
import { facetNodeText, filterFacetTree, foldTreeQuery } from './facet-tree';
import type { FacetTreeNode } from './school-exam-tree';

const leaf = (id: string, label: string, count?: number): FacetTreeNode<string> =>
  ({ id, label, children: [], value: id, ...(count === undefined ? {} : { count }) });
const folder = (id: string, label: string, children: FacetTreeNode<string>[]): FacetTreeNode<string> =>
  ({ id, label, children });

const TREE: FacetTreeNode<string>[] = [
  folder('high', '고등', [
    folder('mh', '무학여고', [leaf('mh-1', '1학기 중간고사')]),
    folder('ss', '성수고', [leaf('ss-1', '1학기 기말고사')]),
  ]),
  folder('mid', '중등', [
    folder('mj', '무학중', [leaf('mj-1', '2학기 기말고사')]),
  ]),
];

describe('facetNodeText', () => {
  it('건수가 있으면 이름 뒤에 (n), 없으면 이름만 — 0 도 적는다', () => {
    expect(facetNodeText(leaf('a', '동백꽃', 14))).toBe('동백꽃 (14)');
    expect(facetNodeText(leaf('a', '대명사', 0))).toBe('대명사 (0)');
    expect(facetNodeText(folder('b', '김유정', []))).toBe('김유정');
  });
});

describe('foldTreeQuery', () => {
  it('띄어쓰기·대소문자·자모 갈림을 맞춘다', () => {
    expect(foldTreeQuery(' 무학 중 ')).toBe('무학중');
    expect(foldTreeQuery('EBS')).toBe('ebs');
    expect(foldTreeQuery('무학')).toBe('무학');
  });
});

describe('filterFacetTree', () => {
  it('비면 트리 그대로(새 배열)', () => {
    const out = filterFacetTree(TREE, '  ');
    expect(out).toEqual(TREE);
    expect(out).not.toBe(TREE);
  });

  it('이름이 맞는 노드는 아래까지 통째로, 아니면 맞는 아이가 있는 가지만 남긴다', () => {
    const out = filterFacetTree(TREE, '무학');
    expect(out.map((n) => n.label)).toEqual(['고등', '중등']);
    expect(out[0].children.map((n) => n.label)).toEqual(['무학여고']);
    expect(out[0].children[0].children.map((n) => n.label)).toEqual(['1학기 중간고사']);
    expect(out[1].children.map((n) => n.label)).toEqual(['무학중']);
  });

  it('가지 이름이 맞으면 그 아래를 거르지 않는다', () => {
    expect(filterFacetTree(TREE, '고등')).toEqual([TREE[0]]);
  });

  it('띄어 써도 찾고, 없으면 빈 배열', () => {
    expect(filterFacetTree(TREE, '성수 고')[0].children.map((n) => n.label)).toEqual(['성수고']);
    expect(filterFacetTree(TREE, '없는학교')).toEqual([]);
  });

  it('건수는 보지 않는다 — 이름만', () => {
    expect(filterFacetTree([leaf('a', '동백꽃', 14)], '14')).toEqual([]);
  });
});
