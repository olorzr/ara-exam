import { describe, it, expect } from 'vitest';
import type { FacetTreeNode } from '@/lib/problem-bank/school-exam-tree';
import type { ReferenceUnit } from '@/types/reference-text';
import { buildReferenceGrammarTree, buildReferenceWorkTree, referenceWorkFacets } from './browse-trees';
import type { ReferenceFacetRow } from './facets';
import { GRAMMAR_NONE_KEY, UNIT_NONE_KEY, axisKey, type ReferenceBrowseAxis } from './filters';
import { buildReferenceUnitTree } from './unit-browse-tree';

const unit = (over: Partial<ReferenceUnit> = {}): ReferenceUnit => ({
  grade: '중2', textbook: '천재(노미숙)', semester: '1학기', unit_path: ['1. 문학', '(1) 시'], ...over,
});

const row = (id: string, over: Partial<ReferenceFacetRow> = {}): ReferenceFacetRow => ({
  id, title: '봄봄', author: '김유정', units: [], grammar_paths: [], ...over,
});

/** 라벨로 자식 노드를 찾는다 */
function child<T>(nodes: FacetTreeNode<T>[], label: string): FacetTreeNode<T> {
  const hit = nodes.find((n) => n.label === label);
  if (!hit) throw new Error(`${label} 없음: ${nodes.map((n) => n.label).join(', ')}`);
  return hit;
}

describe('buildReferenceUnitTree', () => {
  it('학년 › 교과서 › 학기 › 대단원 › 소단원 으로 묶는다', () => {
    const tree = buildReferenceUnitTree([row('a', { units: [unit()] })]);
    const major = child(child(child(child(tree, '중2 (1)').children, '천재(노미숙) (1)').children,
      '1학기 (1)').children, '1. 문학 (1)');
    expect(major.children.map((n) => n.label)).toEqual(['(전체) (1)', '(1) 시 (1)']);
  });

  it('⚠️ 건수는 전문 수다 — 한 전문이 같은 대단원의 소단원 둘에 붙어도 대단원에서는 한 번', () => {
    const tree = buildReferenceUnitTree([
      row('a', { units: [unit(), unit({ unit_path: ['1. 문학', '(2) 소설'] })] }),
      row('b', { units: [unit()] }),
    ]);
    const semester = child(child(child(tree, '중2 (2)').children, '천재(노미숙) (2)').children, '1학기 (2)');
    const major = child(semester.children, '1. 문학 (2)');
    expect(major.children.map((n) => n.label)).toEqual(['(전체) (2)', '(1) 시 (2)', '(2) 소설 (1)']);
    expect(semester.children[0].label).toBe('(전체) (2)');
  });

  it('대단원의 (전체) 잎은 대단원만 든 범위라 그 아래 소단원까지 걸린다', () => {
    const tree = buildReferenceUnitTree([row('a', { units: [unit()] })]);
    const semester = child(child(child(tree, '중2 (1)').children, '천재(노미숙) (1)').children, '1학기 (1)');
    const major = child(semester.children, '1. 문학 (1)');
    expect(major.children[0].value).toEqual({ kind: 'unit', unit: unit({ unit_path: ['1. 문학'] }) });
  });

  it('⚠️ 학년·교과서·학기 폴더에도 맨 앞에 (전체) 잎이 있다 — 교과서 하나를 통째로 볼 수 있어야 한다', () => {
    const tree = buildReferenceUnitTree([
      row('a', { units: [unit()] }),
      row('b', { units: [unit({ unit_path: ['2. 비문학'] })] }),
    ]);
    const grade = child(tree, '중2 (2)');
    expect(grade.children[0]).toMatchObject({ label: '(전체) (2)', value: { kind: 'unit', unit: { grade: '중2' } } });
    const textbook = child(grade.children, '천재(노미숙) (2)');
    expect(textbook.children[0].value).toEqual({ kind: 'unit', unit: { grade: '중2', textbook: '천재(노미숙)' } });
    const semester = child(textbook.children, '1학기 (2)');
    expect(semester.children[0].value).toEqual({
      kind: 'unit', unit: { grade: '중2', textbook: '천재(노미숙)', semester: '1학기' },
    });
  });

  it('소단원이 없는 대단원은 그 자체가 잎이다', () => {
    const tree = buildReferenceUnitTree([row('a', { units: [unit({ unit_path: ['3. 소설'] })] })]);
    const semester = child(child(child(tree, '중2 (1)').children, '천재(노미숙) (1)').children, '1학기 (1)');
    const leaf = child(semester.children, '3. 소설 (1)');
    expect(leaf.children).toEqual([]);
    expect(leaf.value).toEqual({ kind: 'unit', unit: unit({ unit_path: ['3. 소설'] }) });
  });

  it('잎 id 는 축 열쇠와 같고 서로 겹치지 않는다 — 고른 잎의 강조가 축에서 바로 나온다', () => {
    const tree = buildReferenceUnitTree([row('a', { units: [unit(), unit({ semester: '' })] })]);
    const leaves: FacetTreeNode<ReferenceBrowseAxis>[] = [];
    const walk = (nodes: FacetTreeNode<ReferenceBrowseAxis>[]) => nodes.forEach((n) => {
      if (n.value) leaves.push(n);
      walk(n.children);
    });
    walk(tree);
    for (const leaf of leaves) expect(leaf.id).toBe(axisKey(leaf.value as ReferenceBrowseAxis));
    // 학기 '' 폴더의 (전체) 와 교과서 (전체) 는 다른 범위다
    expect(new Set(leaves.map((l) => l.id)).size).toBe(leaves.length);
  });

  it('중학교가 고등학교보다 먼저, 단원은 자연순, 학기 미지정은 맨 뒤', () => {
    const tree = buildReferenceUnitTree([
      row('a', { units: [unit({ grade: '고1' })] }),
      row('b', { units: [unit({ grade: '중3', unit_path: ['10. 끝'] }), unit({ grade: '중3', unit_path: ['2. 중간'] })] }),
      row('c', { units: [unit({ grade: '중3', semester: '' })] }),
    ]);
    expect(tree.map((n) => n.label)).toEqual(['중3 (2)', '고1 (1)']);
    const semesters = tree[0].children[1].children;
    expect(semesters.map((n) => n.label)).toEqual(['(전체) (2)', '1학기 (1)', '학기 미지정 (1)']);
    expect(semesters[1].children.map((n) => n.label)).toEqual(['(전체) (1)', '2. 중간 (1)', '10. 끝 (1)']);
  });

  it('단원을 안 붙인 전문은 맨 끝 "분류 없음" 잎으로 찾는다', () => {
    const tree = buildReferenceUnitTree([row('a'), row('b'), row('c', { units: [unit()] })]);
    const last = tree[tree.length - 1];
    expect(last).toMatchObject({ id: UNIT_NONE_KEY, label: '분류 없음 (2)', value: { kind: 'unit-none' } });
  });

  it('전문이 없으면 빈 트리', () => {
    expect(buildReferenceUnitTree([])).toEqual([]);
  });
});

describe('referenceWorkFacets · buildReferenceWorkTree', () => {
  it('같은 제목의 판본은 한 작품으로 센다 — 누르면 둘이 나란히 나온다', () => {
    const facets = referenceWorkFacets([
      row('a', { author: '' }), row('b'), row('c', { title: '동백꽃' }),
    ]);
    expect(facets).toEqual([
      { title: '봄봄', author: '김유정', count: 2, kind: 'literary' },
      { title: '동백꽃', author: '김유정', count: 1, kind: 'literary' },
    ]);
  });

  it('지은이 › 작품 — 문학 뿌리 폴더는 걷어 낸다', () => {
    const tree = buildReferenceWorkTree([row('a'), row('b', { title: '동백꽃' })], 'author');
    expect(tree.map((n) => n.label)).toEqual(['김유정']);
    expect(tree[0].children.map((n) => n.label)).toEqual(['동백꽃 (1)', '봄봄 (1)']);
    expect(tree[0].children[1].value).toEqual({ kind: 'work', title: '봄봄' });
    expect(tree[0].children[1].id).toBe(axisKey({ kind: 'work', title: '봄봄' }));
  });

  it('작품순이면 평면으로 지은이를 붙여 세운다', () => {
    const tree = buildReferenceWorkTree([row('a')], 'title');
    expect(tree.map((n) => n.label)).toEqual(['봄봄 — 김유정 (1)']);
  });
});

describe('buildReferenceGrammarTree', () => {
  it('마스터 전체를 그리고 붙은 개념에 전문 수를 얹는다', () => {
    const tree = buildReferenceGrammarTree([row('a', { grammar_paths: ['단어 > 품사 > 명사'] })]);
    const word = child(tree, '단어 (1)');
    expect(word.children[0]).toMatchObject({
      label: '(전체) (1)', value: { kind: 'grammar', path: ['단어'] },
    });
    // 0건인 대분류도 흐리게 보인다
    expect(tree.some((n) => n.dimmed)).toBe(true);
  });

  it('⚠️ 가지를 고르면 그 (전체) 잎이 강조된다 — 가지 자체는 잎이 아니다', () => {
    const tree = buildReferenceGrammarTree([row('a', { grammar_paths: ['단어 > 품사 > 명사'] })]);
    const selfLeaf = child(tree, '단어 (1)').children[0];
    expect(axisKey({ kind: 'grammar', path: ['단어'] })).toBe(selfLeaf.id);
  });

  it('문법 분류가 없는 전문은 맨 끝 "분류 없음" 잎으로 찾는다', () => {
    const tree = buildReferenceGrammarTree([row('a'), row('b', { grammar_paths: ['담화'] })]);
    expect(tree[tree.length - 1]).toMatchObject({
      id: GRAMMAR_NONE_KEY, label: '분류 없음 (1)', value: { kind: 'grammar-none' },
    });
  });
});
