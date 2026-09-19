import { describe, it, expect } from 'vitest';
import { collectWorkAuthors, tallyWorkCounts, toWorkFacets } from './work-counts';

describe('tallyWorkCounts', () => {
  it('한 문항이 여러 작품에 걸리면 **양쪽에서** 센다 — 조회가 배열 포함이라 그게 맞다', () => {
    const counts = tallyWorkCounts([['진달래꽃', '엄마 걱정'], ['진달래꽃']]);
    expect(counts.get('진달래꽃')).toBe(2);
    expect(counts.get('엄마 걱정')).toBe(1);
  });

  it('한 문항 안의 중복은 한 번만 센다 — 옛 행에 같은 제목이 두 번 있을 수 있다', () => {
    expect(tallyWorkCounts([['동백꽃', '동백꽃']]).get('동백꽃')).toBe(1);
  });

  it('빈 이름은 세지 않는다', () => {
    expect(tallyWorkCounts([['', '동백꽃'], []]).size).toBe(1);
  });
});

describe('collectWorkAuthors', () => {
  const work = (title: string, author: string) => ({ label: '', title, author });

  it('지문의 작품에서 제목 → 지은이를 모은다', () => {
    const authors = collectWorkAuthors([[work('진달래꽃', '김소월'), work('엄마 걱정', '기형도')]]);
    expect(authors.get('진달래꽃')).toBe('김소월');
    expect(authors.get('엄마 걱정')).toBe('기형도');
  });

  it('같은 제목에 지은이가 갈리면 가장 많이 쓰인 이름을 고른다', () => {
    const authors = collectWorkAuthors([
      [work('동백꽃', '김유정')], [work('동백꽃', '김유정')], [work('동백꽃', '오기')],
    ]);
    expect(authors.get('동백꽃')).toBe('김유정');
  });

  it('지은이가 비면 담지 않는다 — 트리가 지은이 미입력 폴더로 받는다', () => {
    expect(collectWorkAuthors([[work('동백꽃', '')]]).size).toBe(0);
  });
});

describe('toWorkFacets', () => {
  it('제목 한글 사전순으로 세우고 모르는 지은이는 빈 문자열이다', () => {
    const facets = toWorkFacets(
      new Map([['엄마 걱정', 3], ['진달래꽃', 5]]),
      new Map([['진달래꽃', '김소월']]),
    );
    expect(facets).toEqual([
      { title: '엄마 걱정', author: '', count: 3 },
      { title: '진달래꽃', author: '김소월', count: 5 },
    ]);
  });
});
