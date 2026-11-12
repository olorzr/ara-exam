import { describe, expect, it } from 'vitest';
import { isSetSourceType, parseSourceSets } from './source-sets-payload';

const good = {
  source_type: '내신기출', year: '2026', grade: '중2', semester: '1학기', exam_type: '중간',
  textbook: '비상(박영민)', publisher: '', exam_count: 3, names: ['무학중학교', '광희중학교', '동마중학교'],
};

describe('parseSourceSets', () => {
  it('모양이 맞는 원소를 그대로 읽는다', () => {
    expect(parseSourceSets([good])).toEqual([good]);
  });

  it('null 칸은 빈 글자로 읽는다(DB 의 빈 값 규약)', () => {
    const [row] = parseSourceSets([{ ...good, textbook: null, publisher: undefined }]);
    expect(row.textbook).toBe('');
    expect(row.publisher).toBe('');
  });

  it('모양이 어긋난 원소만 버린다 — 나머지는 남는다', () => {
    const rows = parseSourceSets([
      good,
      { ...good, names: '무학중' },
      { ...good, names: [] },
      { ...good, exam_count: 0 },
      { ...good, exam_count: 1.5 },
      { ...good, source_type: '평가문제집' },
      { ...good, year: 2026 },
      null,
      '세트',
    ]);
    expect(rows).toEqual([good]);
  });

  it('배열이 아니면 빈 배열', () => {
    expect(parseSourceSets(null)).toEqual([]);
    expect(parseSourceSets({ sets: [good] })).toEqual([]);
  });
});

describe('isSetSourceType', () => {
  it('내신기출·모의고사만 세트다', () => {
    expect(isSetSourceType('내신기출')).toBe(true);
    expect(isSetSourceType('모의고사')).toBe(true);
    expect(isSetSourceType('평가문제집')).toBe(false);
    expect(isSetSourceType('문제집')).toBe(false);
    expect(isSetSourceType(null)).toBe(false);
  });
});
