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

describe('buildCategoryTree — 학기 구분 없는 교과서 (고등 선택과목)', () => {
  const elective = (overrides: Partial<Category> = {}): Category =>
    makeCategory({ level: '고등', grade: '고2', publisher: '문학 비상', semester: '', ...overrides });

  it('학기가 빈 대단원은 학기 폴더 없이 출판사 바로 아래 온다', () => {
    const tree = buildCategoryTree([
      elective({ id: 'a', chapter: '1. 나를 깨우는, 문학' }),
      elective({ id: 'b', chapter: '2. 다양한 빛깔로 만나는, 문학' }),
    ]);
    const publisher = findByPath(tree, ['고등', '고2', '문학 비상']);
    expect(publisher?.children.map((n) => n.label)).toEqual(['1. 나를 깨우는, 문학', '2. 다양한 빛깔로 만나는, 문학']);
    expect(publisher?.children.every((n) => n.type === 'chapter')).toBe(true);
    expect(findByPath(tree, ['고등', '고2', '문학 비상', '미지정'])).toBeUndefined();
    expect(publisher?.children[0].category?.id).toBe('a');
  });

  it('소단원이 있는 대단원도 출판사 바로 아래 폴더가 되고 id 가 학기 폴더 아래 것과 겹치지 않는다', () => {
    const tree = buildCategoryTree([
      elective({ id: 'a', chapter: '1. 단원', sub_chapter: '(1) 소단원' }),
      elective({ id: 'b', chapter: '1. 단원', sub_chapter: '' }),
    ]);
    const chapter = findByPath(tree, ['고등', '고2', '문학 비상', '1. 단원']);
    expect(chapter?.id).toBe('고등-고2-문학 비상--1. 단원');
    expect(chapter?.children.map((n) => n.label)).toEqual(['(1) 소단원', '(전체)']);
  });

  it('공통국어처럼 학기가 있는 교과서는 학기 폴더를 그대로 둔다', () => {
    const tree = buildCategoryTree([
      makeCategory({ id: 'a', level: '고등', grade: '고1', publisher: '공통국어 창비', semester: '1학기' }),
      makeCategory({ id: 'b', level: '고등', grade: '고1', publisher: '공통국어 창비', semester: '2학기' }),
    ]);
    const publisher = findByPath(tree, ['고등', '고1', '공통국어 창비']);
    expect(publisher?.children.map((n) => [n.type, n.label])).toEqual([['semester', '1학기'], ['semester', '2학기']]);
  });

  it('한 교과서에 학기 폴더와 학기 없는 대단원이 섞이면 학기 폴더가 앞이다', () => {
    const tree = buildCategoryTree([
      elective({ id: 'a', chapter: '1. 문학' }),
      elective({ id: 'b', chapter: '2. 문법', semester: '1학기' }),
    ]);
    const publisher = findByPath(tree, ['고등', '고2', '문학 비상']);
    expect(publisher?.children.map((n) => [n.type, n.label])).toEqual([['semester', '1학기'], ['chapter', '1. 문학']]);
  });
});

describe('buildCategoryTree — 학년 구분 없는 교과서 (고등 선택과목)', () => {
  it("학년이 빈 고등 교과서는 '선택과목' 폴더 아래, 학기 폴더 없이 교과서 › 대단원", () => {
    const tree = buildCategoryTree([
      makeCategory({ id: 'a', level: '고등', grade: '', publisher: '문학 비상', semester: '', chapter: '1. 나를 깨우는, 문학' }),
      makeCategory({ id: 'b', level: '고등', grade: '고1', publisher: '공통국어 창비', semester: '1학기', chapter: '1. 문학' }),
    ]);
    const high = findByPath(tree, ['고등']);
    expect(high?.children.map((n) => n.label)).toEqual(['고1', '선택과목']);
    const elective = findByPath(tree, ['고등', '선택과목', '문학 비상', '1. 나를 깨우는, 문학']);
    expect(elective?.category?.id).toBe('a');
    expect(findByPath(tree, ['고등', '선택과목'])?.id).toBe('고등-');
  });

  it("중등의 빈 학년은 '선택과목' 이 아니라 '미지정' — 중등에는 선택과목이 없다", () => {
    const tree = buildCategoryTree([makeCategory({ id: 'a', grade: '' })]);
    expect(findByPath(tree, ['중등'])?.children.map((n) => n.label)).toEqual(['미지정']);
  });
});

describe('buildCategoryTree — 이름이 자바스크립트 예약 속성일 때', () => {
  // ⚠️ 코덱스 리뷰: 묶는 그릇이 평범한 객체면 이 이름들이 **물려받은 속성**으로 잡혀
  //    `acc[key].push` 가 함수가 아니라 터지고, 개념지 목록이 통째로 안 그려졌다.
  //    카테고리 이름은 선생님이 직접 치는 자유 텍스트라 실제로 들어올 수 있다.
  it.each(['__proto__', 'constructor', 'toString', 'valueOf', 'hasOwnProperty'])(
    "출판사가 '%s' 여도 트리를 만든다",
    (name) => {
      const tree = buildCategoryTree([makeCategory({ id: 'a', publisher: name })]);
      expect(() => JSON.stringify(tree)).not.toThrow();
      expect(findByPath(tree, ['중등', '중1', name])).toBeDefined();
    },
  );

  it("학교명·프린트명이 '__proto__' 여도 외부지문 트리를 만든다", () => {
    const tree = buildCategoryTree([
      external({ id: 'b', school_name: '__proto__', chapter: '__proto__' }),
    ]);
    const node = findByPath(tree, ['외부지문 및 프린트', '__proto__', '미지정', '미지정', '__proto__']);
    expect(node).toBeDefined();
  });

  it('예약 속성 이름과 평범한 이름이 섞여도 서로 안 먹는다', () => {
    const tree = buildCategoryTree([
      makeCategory({ id: 'c', publisher: '__proto__' }),
      makeCategory({ id: 'd', publisher: '비상' }),
    ]);
    const grade = findByPath(tree, ['중등', '중1']);
    expect(grade?.children.map((n) => n.label).sort()).toEqual(['__proto__', '비상']);
  });
});
