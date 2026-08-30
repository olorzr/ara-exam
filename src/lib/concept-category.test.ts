import { describe, it, expect } from 'vitest';
import { conceptCategoryKey, conceptSheetToCategory } from './concept-category';
import { buildCategoryTree } from './category-tree';
import { EXTERNAL_LEVEL } from './constants';
import type { ConceptSheetListItem } from '@/types';

const sheet = (o: Partial<ConceptSheetListItem> = {}): ConceptSheetListItem => ({
  id: 'sheet-1',
  title: '개념지',
  level: '중등',
  year: '',
  grade: '중1',
  publisher: '천재(정호웅)',
  semester: '1학기',
  unit: '1단원',
  subunit: '',
  school_name: '',
  marks: [],
  user_id: 'u1',
  created_at: '2026-08-30T00:00:00Z',
  updated_at: '2026-08-30T00:00:00Z',
  ...o,
} as ConceptSheetListItem);

describe('conceptCategoryKey — 표기 변형 수렴', () => {
  const canonical = conceptSheetToCategory(sheet()).id;

  it('괄호 앞 공백이 있어도 같은 키', () => {
    expect(conceptSheetToCategory(sheet({ publisher: '천재 (정호웅)' })).id).toBe(canonical);
  });

  it('전각 괄호여도 같은 키', () => {
    expect(conceptSheetToCategory(sheet({ publisher: '천재（정호웅）' })).id).toBe(canonical);
  });

  it('폭 없는 문자(U+200B)가 끼어도 같은 키', () => {
    expect(conceptSheetToCategory(sheet({ publisher: '천재​(정호웅)' })).id).toBe(canonical);
  });

  it('NBSP 가 끼어도 같은 키', () => {
    expect(conceptSheetToCategory(sheet({ publisher: '천재 (정호웅)' })).id).toBe(canonical);
  });

  it('대단원·소단원·학교명도 정규화한다', () => {
    const a = conceptSheetToCategory(sheet({ unit: '1. 문학 ( 상 )', subunit: '소나기 (황순원)' }));
    const b = conceptSheetToCategory(sheet({ unit: '1. 문학(상)', subunit: '소나기(황순원)' }));
    expect(a.id).toBe(b.id);
  });

  it('진짜 다른 출판사는 합치지 않는다', () => {
    expect(conceptSheetToCategory(sheet({ publisher: '비상(김진수)' })).id).not.toBe(canonical);
  });

  it('학년이 다르면 합치지 않는다', () => {
    expect(conceptSheetToCategory(sheet({ grade: '중2' })).id).not.toBe(canonical);
  });

  it('외부지문은 학교명·년도가 다르면 합치지 않는다', () => {
    const base = sheet({ level: EXTERNAL_LEVEL, school_name: '상현중', year: '2026', publisher: '' });
    const other = sheet({ ...base, school_name: '수지중' });
    const older = sheet({ ...base, year: '2025' });
    expect(conceptSheetToCategory(other).id).not.toBe(conceptSheetToCategory(base).id);
    expect(conceptSheetToCategory(older).id).not.toBe(conceptSheetToCategory(base).id);
  });

  it('합성 Category 는 정규형 표기를 노출한다 (트리 라벨)', () => {
    expect(conceptSheetToCategory(sheet({ publisher: '천재 (정호웅)' })).publisher).toBe('천재(정호웅)');
  });

  it('Category 를 그대로 넣어도 같은 키가 나온다 (필터/트리 대칭)', () => {
    const cat = conceptSheetToCategory(sheet({ publisher: '천재 (정호웅)' }));
    expect(conceptCategoryKey(cat)).toBe(cat.id);
  });
});

describe('트리 그룹화 — 실제 증상 재현', () => {
  it('표기가 다른 두 개념지가 출판사 노드 하나로 합쳐진다', () => {
    const sheets = [
      sheet({ id: 'a', publisher: '천재(정호웅)' }),
      sheet({ id: 'b', publisher: '천재 (정호웅)' }),
    ];
    const cats = Array.from(
      new Map(sheets.map((s) => [conceptSheetToCategory(s).id, conceptSheetToCategory(s)])).values(),
    );
    const publishers = buildCategoryTree(cats)[0].children[0].children;
    expect(publishers).toHaveLength(1);
    expect(publishers[0].label).toBe('천재(정호웅)');
  });

  it('선택한 노드로 필터하면 두 표기의 개념지가 모두 남는다 (조용한 유실 없음)', () => {
    const sheets = [
      sheet({ id: 'a', publisher: '천재(정호웅)' }),
      sheet({ id: 'b', publisher: '천재 (정호웅)' }),
      sheet({ id: 'c', publisher: '비상(김진수)' }),
    ];
    const selected = conceptSheetToCategory(sheets[0]);
    const targetKey = conceptCategoryKey(selected);
    const matched = sheets.filter((s) => conceptSheetToCategory(s).id === targetKey);
    expect(matched.map((s) => s.id)).toEqual(['a', 'b']);
  });
});
