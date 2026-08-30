import { describe, it, expect } from 'vitest';
import { categoryNaturalKey, withNormalizedCategoryNames } from './category-key';
import { buildCategoryTree } from './category-tree';
import type { Category } from '@/types';

const cat = (o: Partial<Category> = {}): Category => ({
  id: 'c1',
  level: '중등',
  year: '',
  grade: '중1',
  publisher: '천재(정호웅)',
  semester: '1학기',
  chapter: '1단원',
  sub_chapter: '',
  school_name: '',
  user_id: 'u1',
  created_at: '2026-08-30T00:00:00Z',
  ...o,
});

describe('categoryNaturalKey', () => {
  it('괄호 앞 공백 변형이 같은 키로 수렴한다', () => {
    expect(categoryNaturalKey(cat({ publisher: '천재 (정호웅)' })))
      .toBe(categoryNaturalKey(cat()));
  });

  it('전각 괄호·폭 없는 문자도 같은 키', () => {
    expect(categoryNaturalKey(cat({ publisher: '천재（정호웅）' }))).toBe(categoryNaturalKey(cat()));
    expect(categoryNaturalKey(cat({ publisher: '천재​(정호웅)' }))).toBe(categoryNaturalKey(cat()));
  });

  it('소단원이 다르면 다른 키다 (과하게 합치지 않는다)', () => {
    expect(categoryNaturalKey(cat({ sub_chapter: '소나기' })))
      .not.toBe(categoryNaturalKey(cat({ sub_chapter: '수난이대' })));
  });

  it('year / school_name 이 키에 포함된다', () => {
    expect(categoryNaturalKey(cat({ year: '2026' }))).not.toBe(categoryNaturalKey(cat({ year: '2025' })));
    expect(categoryNaturalKey(cat({ school_name: '상현중' }))).not.toBe(categoryNaturalKey(cat({ school_name: '수지중' })));
  });

  it('이름에 구분자 | 가 섞여도 필드 경계가 모호해지지 않는다', () => {
    // join('|') 이던 시절엔 아래 둘이 같은 키가 되어 무관한 카테고리가 한 노드로 합쳐졌다.
    const a = categoryNaturalKey(cat({ chapter: '1단원|소나기', sub_chapter: '황순원' }));
    const b = categoryNaturalKey(cat({ chapter: '1단원', sub_chapter: '소나기|황순원' }));
    expect(a).not.toBe(b);
  });

  it('year / school_name 이 null 이어도 throw 하지 않고 빈 값으로 다룬다', () => {
    expect(categoryNaturalKey(cat({ year: null as unknown as string })))
      .toBe(categoryNaturalKey(cat({ year: '' })));
    expect(categoryNaturalKey(cat({ school_name: undefined })))
      .toBe(categoryNaturalKey(cat({ school_name: '' })));
  });
});

describe('withNormalizedCategoryNames', () => {
  it('이름 필드를 정규형으로 바꾼다', () => {
    const n = withNormalizedCategoryNames(cat({ publisher: '천재 (정호웅)', chapter: '1. 문학 ( 상 )' }));
    expect(n.publisher).toBe('천재(정호웅)');
    expect(n.chapter).toBe('1. 문학(상)');
  });

  it('원본을 변경하지 않는다', () => {
    const original = cat({ publisher: '천재 (정호웅)' });
    withNormalizedCategoryNames(original);
    expect(original.publisher).toBe('천재 (정호웅)');
  });

  it('id·user_id 같은 비이름 필드는 건드리지 않는다', () => {
    const n = withNormalizedCategoryNames(cat({ id: 'uuid-1  ', user_id: 'u  1' }));
    expect(n.id).toBe('uuid-1  ');
    expect(n.user_id).toBe('u  1');
  });
});

describe('트리 그룹화 — 마스터에 두 표기가 남아 있을 때', () => {
  it('값까지 정규화하면 출판사 노드가 하나로 합쳐지고 소단원이 모두 붙는다', () => {
    // 실제 증상: 소단원(1)은 '천재 (정호웅)' 아래, 소단원(2)는 '천재(정호웅)' 아래
    const rows = [
      cat({ id: 'a', publisher: '천재 (정호웅)', sub_chapter: '소단원(1)' }),
      cat({ id: 'b', publisher: '천재(정호웅)', sub_chapter: '소단원(2)' }),
    ].map(withNormalizedCategoryNames);

    const publishers = buildCategoryTree(rows)[0].children[0].children;
    expect(publishers).toHaveLength(1);
    expect(publishers[0].label).toBe('천재(정호웅)');

    const subs = publishers[0].children[0].children[0].children;
    expect(subs.map((n) => n.label).sort()).toEqual(['소단원(1)', '소단원(2)']);
  });

  it('정규화하지 않으면 두 노드로 갈라진다 (회귀 방지)', () => {
    const rows = [
      cat({ id: 'a', publisher: '천재 (정호웅)', sub_chapter: '소단원(1)' }),
      cat({ id: 'b', publisher: '천재(정호웅)', sub_chapter: '소단원(2)' }),
    ];
    expect(buildCategoryTree(rows)[0].children[0].children).toHaveLength(2);
  });
});
