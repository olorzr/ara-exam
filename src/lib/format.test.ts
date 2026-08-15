import { describe, it, expect } from 'vitest';
import { formatCategoryLabel, groupCategoriesByLevel, toLocalDateString } from './format';
import type { Category } from '@/types';

const makeCategory = (overrides: Partial<Category> = {}): Category => ({
  id: '1',
  level: '중등',
  year: '',
  grade: '중1',
  publisher: '비상',
  semester: '1학기',
  chapter: 'Lesson 1',
  sub_chapter: '본문1',
  user_id: 'user-1',
  created_at: '2026-01-01',
  ...overrides,
});

describe('formatCategoryLabel', () => {
  it('중등/고등 카테고리를 올바르게 포맷한다', () => {
    const cat = makeCategory();
    expect(formatCategoryLabel(cat)).toBe('중1 비상 1학기 Lesson 1 본문1');
  });

  it('외부지문 카테고리를 올바르게 포맷한다', () => {
    const cat = makeCategory({
      level: '외부지문 및 프린트',
      school_name: 'OO중학교',
      year: '2026',
      grade: '중2',
      chapter: '프린트1',
      sub_chapter: '',
    });
    expect(formatCategoryLabel(cat)).toBe('OO중학교 2026 중2 - 프린트1');
  });

  it('외부지문의 년도·학년이 미지정이면 생략한다', () => {
    const cat = makeCategory({
      level: '외부지문 및 프린트',
      school_name: 'OO중학교',
      year: '',
      grade: '',
      chapter: '프린트1',
      sub_chapter: '',
    });
    expect(formatCategoryLabel(cat)).toBe('OO중학교 - 프린트1');
  });

  it('외부지문에 학교명이 없으면 "외부"로 표시한다', () => {
    const cat = makeCategory({
      level: '외부지문 및 프린트',
      school_name: '',
      year: '',
      grade: '',
      chapter: '프린트1',
      sub_chapter: '',
    });
    expect(formatCategoryLabel(cat)).toBe('외부 - 프린트1');
  });
});

describe('groupCategoriesByLevel', () => {
  it('레벨별로 카테고리를 그룹화한다', () => {
    const categories = [
      makeCategory({ id: '1', level: '중등' }),
      makeCategory({ id: '2', level: '고등' }),
      makeCategory({ id: '3', level: '중등' }),
    ];
    const grouped = groupCategoriesByLevel(categories);
    expect(Object.keys(grouped)).toHaveLength(2);
    expect(grouped['중등']).toHaveLength(2);
    expect(grouped['고등']).toHaveLength(1);
  });

  it('빈 배열이면 빈 객체를 반환한다', () => {
    expect(groupCategoriesByLevel([])).toEqual({});
  });
});

describe('toLocalDateString', () => {
  it('로컬 타임존 기준 날짜를 YYYY-MM-DD 로 반환한다(자정 부근에도 어긋나지 않음)', () => {
    // 로컬 자정 직후 시각을 ISO(UTC)로 직렬화한 뒤 다시 로컬 날짜로 환산해도
    // 동일한 로컬 날짜가 나와야 한다. 실행 환경 타임존과 무관하게 검증된다.
    const local = new Date(2026, 5, 16, 0, 30); // 2026-06-16 00:30 로컬
    expect(toLocalDateString(local.toISOString())).toBe('2026-06-16');
  });

  it('월·일을 0으로 패딩한다', () => {
    const local = new Date(2026, 0, 5, 12, 0); // 2026-01-05 정오 로컬
    expect(toLocalDateString(local.toISOString())).toBe('2026-01-05');
  });
});
