import { describe, it, expect } from 'vitest';
import { buildUnitTree, UNIT_DEPTH_MAX, unitPathLabel } from './unit-tree';
import type { MajorChapter, SubChapter } from '@/types';

const major = (id: string, name: string, over: Partial<MajorChapter> = {}): MajorChapter => ({
  id, name, publisher_id: 'pub1', grade: '중2', semester: '1학기', created_at: '', ...over,
});
const sub = (id: string, name: string, majorId: string): SubChapter => ({
  id, name, major_chapter_id: majorId, created_at: '',
});

describe('buildUnitTree', () => {
  it('대단원 아래 소단원을 붙인다', () => {
    const tree = buildUnitTree(
      [major('m1', '1. 문학의 즐거움')],
      [sub('s1', '(1) 시', 'm1'), sub('s2', '(2) 소설', 'm1')],
    );
    expect(tree).toHaveLength(1);
    expect(tree[0].children.map((c) => c.name)).toEqual(['(1) 시', '(2) 소설']);
  });

  it('번호를 숫자로 견준다 — 10단원이 2단원 뒤에 온다', () => {
    const tree = buildUnitTree([major('m2', '10. 매체'), major('m1', '2. 문법')], []);
    expect(tree.map((n) => n.name)).toEqual(['2. 문법', '10. 매체']);
  });

  it('학기가 달라 같은 이름이 두 번 오면 하나로 합치고 소단원을 모은다', () => {
    const tree = buildUnitTree(
      [major('m1', '1. 문학'), major('m2', '1. 문학', { semester: '2학기' })],
      [sub('s1', '(1) 시', 'm1'), sub('s2', '(2) 소설', 'm2')],
    );
    expect(tree).toHaveLength(1);
    expect(tree[0].children.map((c) => c.name)).toEqual(['(1) 시', '(2) 소설']);
  });

  it('같은 이름의 소단원은 한 번만 담는다', () => {
    const tree = buildUnitTree(
      [major('m1', '1. 문학'), major('m2', '1. 문학')],
      [sub('s1', '(1) 시', 'm1'), sub('s2', '(1) 시', 'm2')],
    );
    expect(tree[0].children).toHaveLength(1);
  });

  it('다른 대단원의 소단원을 끌어오지 않는다', () => {
    const tree = buildUnitTree(
      [major('m1', '1. 문학'), major('m2', '2. 문법')],
      [sub('s1', '(1) 시', 'm1')],
    );
    expect(tree[1].children).toHaveLength(0);
  });

  it('이름이 빈 행은 버린다', () => {
    expect(buildUnitTree([major('m1', '  ')], [])).toEqual([]);
  });

  it('빈 입력이면 빈 트리', () => {
    expect(buildUnitTree([], [])).toEqual([]);
  });
});

describe('unitPathLabel / 단계 상한', () => {
  it('경로를 한 줄로 보여 준다', () => {
    expect(unitPathLabel(['1. 문학', '(1) 시'])).toBe('1. 문학 > (1) 시');
  });

  it('단원은 두 단계다 — DB CHECK(cardinality <= 2) 와 같은 값', () => {
    expect(UNIT_DEPTH_MAX).toBe(2);
  });
});
