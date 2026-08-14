import { describe, it, expect } from 'vitest';
import { matchScopeToCategories } from './match';
import type { Category } from '@/types';
import type { PublicTextbook } from './types';

/** 테스트용 카테고리 생성 헬퍼 */
const cat = (over: Partial<Category>): Category => ({
  id: 'id',
  level: '중등',
  grade: '중2',
  publisher: '비상교육',
  semester: '1학기',
  chapter: '문학의 즐거움',
  sub_chapter: '',
  user_id: 'u',
  created_at: '',
  ...over,
});

const textbook: PublicTextbook = {
  id: 'tb-1',
  school_level: '중등',
  grade: '중2',
  publisher: '비상교육',
  book_title: '중학국어 2',
};

describe('matchScopeToCategories', () => {
  it('대단원 키는 그 대단원의 모든 소단원 카테고리로 확장된다', () => {
    const categories = [
      cat({ id: 'a', sub_chapter: '시의 세계' }),
      cat({ id: 'b', sub_chapter: '소설의 세계' }),
      cat({ id: 'c', chapter: '문법의 기초', sub_chapter: '품사' }),
    ];
    const r = matchScopeToCategories(['문학의 즐거움'], textbook, 1, categories);
    expect(r.matchedIds.sort()).toEqual(['a', 'b']);
    expect(r.unmatchedUnits).toEqual([]);
  });

  it('"대단원 > 소단원" 복합키는 해당 소단원만 매칭한다', () => {
    const categories = [
      cat({ id: 'a', sub_chapter: '시의 세계' }),
      cat({ id: 'b', sub_chapter: '소설의 세계' }),
    ];
    const r = matchScopeToCategories(['문학의 즐거움 > 시의 세계'], textbook, 1, categories);
    expect(r.matchedIds).toEqual(['a']);
  });

  it('제목의 공백 차이(내부 공백·trim)를 흡수한다', () => {
    const categories = [cat({ id: 'a', chapter: '문학의  즐거움 ', sub_chapter: '시의 세계' })];
    const r = matchScopeToCategories(['문학의 즐거움'], textbook, 1, categories);
    expect(r.matchedIds).toEqual(['a']);
  });

  it('출판사는 공백을 전부 제거하고 비교한다', () => {
    const categories = [cat({ id: 'a', publisher: '비상 교육', sub_chapter: '시의 세계' })];
    const r = matchScopeToCategories(['문학의 즐거움'], textbook, 1, categories);
    expect(r.matchedIds).toEqual(['a']);
  });

  it('다른 학기 카테고리는 제외하고, 학기 미지정은 통과시킨다', () => {
    const categories = [
      cat({ id: 'a', semester: '2학기', sub_chapter: '시의 세계' }),
      cat({ id: 'b', semester: '미지정', sub_chapter: '소설의 세계' }),
    ];
    const r = matchScopeToCategories(['문학의 즐거움'], textbook, 1, categories);
    expect(r.matchedIds).toEqual(['b']);
  });

  it('level/grade/publisher 가 다르면 후보에서 제외된다', () => {
    const categories = [
      cat({ id: 'a', level: '고등', grade: '고1' }),
      cat({ id: 'b', publisher: '천재교과서' }),
    ];
    const r = matchScopeToCategories(['문학의 즐거움'], textbook, 1, categories);
    expect(r.matchedIds).toEqual([]);
    expect(r.unmatchedUnits).toEqual(['문학의 즐거움']);
  });

  it('못 찾은 단원 키는 unmatchedUnits 로 표면화한다 (조용한 유실 금지)', () => {
    const categories = [cat({ id: 'a', sub_chapter: '시의 세계' })];
    const r = matchScopeToCategories(
      ['문학의 즐거움', '없는 단원', '문학의 즐거움 > 없는 소단원'],
      textbook, 1, categories,
    );
    expect(r.matchedIds).toEqual(['a']);
    expect(r.unmatchedUnits).toEqual(['없는 단원', '문학의 즐거움 > 없는 소단원']);
  });

  it('여러 키가 같은 카테고리를 가리켜도 id 는 중복되지 않는다', () => {
    const categories = [cat({ id: 'a', sub_chapter: '시의 세계' })];
    const r = matchScopeToCategories(
      ['문학의 즐거움', '문학의 즐거움 > 시의 세계'],
      textbook, 1, categories,
    );
    expect(r.matchedIds).toEqual(['a']);
  });
});
