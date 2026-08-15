import { describe, it, expect } from 'vitest';
import { buildCategoryTree, type CategoryTreeNode } from './category-tree';
import type { Category } from '@/types';

const makeCategory = (overrides: Partial<Category> = {}): Category => ({
  id: '1',
  level: '중등',
  year: '',
  grade: '중1',
  publisher: '비상',
  semester: '1학기',
  chapter: '1. 문학의 갈래',
  sub_chapter: '',
  school_name: '',
  user_id: 'user-1',
  created_at: '2026-01-01',
  ...overrides,
});

const external = (overrides: Partial<Category> = {}): Category =>
  makeCategory({
    level: '외부지문 및 프린트',
    grade: '',
    publisher: '',
    semester: '',
    school_name: '상현중학교',
    chapter: '소나기',
    ...overrides,
  });

/** 라벨 경로로 노드를 찾는다 (예: ['외부지문 및 프린트', '상현중학교', '2026학년도']) */
function findByPath(nodes: CategoryTreeNode[], path: string[]): CategoryTreeNode | undefined {
  let current: CategoryTreeNode | undefined;
  let level = nodes;
  for (const label of path) {
    current = level.find((n) => n.label === label);
    if (!current) return undefined;
    level = current.children;
  }
  return current;
}

describe('buildCategoryTree — 외부지문', () => {
  it('학교 > 년도 > 학년 > 프린트 순으로 계층을 만든다', () => {
    const tree = buildCategoryTree([
      external({ id: 'a', year: '2026', grade: '중2', chapter: '소나기' }),
      external({ id: 'b', year: '2026', grade: '중2', chapter: '자전거 도둑' }),
      external({ id: 'c', year: '2026', grade: '중3', chapter: '수능특강' }),
      external({ id: 'd', year: '2025', grade: '중2', chapter: '작년 프린트' }),
    ]);

    const grade2 = findByPath(tree, ['외부지문 및 프린트', '상현중학교', '2026학년도', '중2']);
    expect(grade2?.type).toBe('grade');
    expect(grade2?.children.map((n) => n.label)).toEqual(['소나기', '자전거 도둑']);

    const year2026 = findByPath(tree, ['외부지문 및 프린트', '상현중학교', '2026학년도']);
    expect(year2026?.type).toBe('year');
    expect(year2026?.children.map((n) => n.label)).toEqual(['중2', '중3']);

    const school = findByPath(tree, ['외부지문 및 프린트', '상현중학교']);
    expect(school?.children.map((n) => n.label)).toEqual(['2025학년도', '2026학년도']);
  });

  it('년도·학년이 비어 있는 과거 데이터를 미지정 노드로 노출한다', () => {
    const tree = buildCategoryTree([external({ id: 'a', year: '', grade: '', chapter: '옛 프린트' })]);

    const node = findByPath(tree, ['외부지문 및 프린트', '상현중학교', '미지정', '미지정', '옛 프린트']);
    expect(node?.type).toBe('material');
    expect(node?.category?.id).toBe('a');
  });

  it('프린트 노드는 leaf 이고 category 를 갖는다(선택 가능)', () => {
    const tree = buildCategoryTree([external({ id: 'a', year: '2026', grade: '중2' })]);
    const node = findByPath(tree, ['외부지문 및 프린트', '상현중학교', '2026학년도', '중2', '소나기']);
    expect(node?.children).toHaveLength(0);
    expect(node?.category?.id).toBe('a');
  });
});

describe('buildCategoryTree — 중등/고등', () => {
  it('소단원이 없는 단일 대단원은 그 자체가 선택 가능한 leaf 다', () => {
    const tree = buildCategoryTree([makeCategory({ id: 'a', sub_chapter: '' })]);
    const chapter = findByPath(tree, ['중등', '중1', '비상', '1학기', '1. 문학의 갈래']);
    expect(chapter?.children).toHaveLength(0);
    expect(chapter?.category?.id).toBe('a');
  });

  it('소단원이 있으면 대단원은 폴더가 되고 sub_chapter 가 빈 행은 (전체)로 뜬다', () => {
    const tree = buildCategoryTree([
      makeCategory({ id: 'a', sub_chapter: '' }),
      makeCategory({ id: 'b', sub_chapter: '(1) 시의 이해' }),
    ]);
    const chapter = findByPath(tree, ['중등', '중1', '비상', '1학기', '1. 문학의 갈래']);
    expect(chapter?.category).toBeUndefined();
    expect(chapter?.children.map((n) => n.label)).toEqual(['(1) 시의 이해', '(전체)']);
    expect(chapter?.children.find((n) => n.label === '(전체)')?.category?.id).toBe('a');
  });
});
