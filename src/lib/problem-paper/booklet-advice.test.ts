import { describe, expect, it } from 'vitest';
import { bookletBlankCount, bookletSheetCount } from '@/lib/print/booklet';
import { adviseDropBackCover, backCoverOnlyBlanks, coverWithoutBack, type BackCoverAdviceInput } from './booklet-advice';
import { DEFAULT_SIMPLE_COVER, type PaperCover } from './cover';

const withBack: PaperCover = { ...DEFAULT_SIMPLE_COVER, backKind: 'design' };

describe('backCoverOnlyBlanks', () => {
  it('본문 3·7·11쪽 — 뒷표지만 빼면 딱 맞는다', () => {
    expect([3, 7, 11].map(backCoverOnlyBlanks)).toEqual([true, true, true]);
  });

  it('그 밖의 본문 쪽 수는 아니다', () => {
    expect([0, 1, 2, 4, 5, 6, 8, 9, 10].map(backCoverOnlyBlanks)).toEqual(Array(9).fill(false));
  });

  it('이상한 값은 아니다', () => {
    expect([-1, 2.5, Number.NaN, Number.POSITIVE_INFINITY].map(backCoverOnlyBlanks)).toEqual(Array(4).fill(false));
  });

  it('권하는 때는 늘 빈 면 셋이 사라지고 A3 가 한 장 준다 — 안내 문구가 기대는 사실', () => {
    for (let body = 0; body <= 60; body++) {
      if (!backCoverOnlyBlanks(body)) continue;
      expect(bookletBlankCount(body + 2), `${body}쪽`).toBe(3);
      expect(bookletBlankCount(body + 1), `${body}쪽`).toBe(0);
      expect(bookletSheetCount(body + 2) - bookletSheetCount(body + 1), `${body}쪽`).toBe(1);
    }
  });
});

describe('adviseDropBackCover', () => {
  const base: BackCoverAdviceInput = { printLayout: 'booklet', cover: withBack, coverUnknown: false, bodyPages: 3 };

  it('중철 · 뒷표지 있음 · 본문 3쪽이면 권한다', () => {
    expect(adviseDropBackCover(base)).toBe(true);
    expect(adviseDropBackCover({ ...base, cover: { ...withBack, backKind: 'image', backImagePath: 'b.jpg' } })).toBe(true);
  });

  it('조건 하나라도 빠지면 권하지 않는다', () => {
    expect(adviseDropBackCover({ ...base, printLayout: 'single' })).toBe(false);
    expect(adviseDropBackCover({ ...base, cover: null })).toBe(false);
    expect(adviseDropBackCover({ ...base, cover: { ...withBack, backKind: 'none' } })).toBe(false);
    expect(adviseDropBackCover({ ...base, coverUnknown: true })).toBe(false);
    expect(adviseDropBackCover({ ...base, bodyPages: null })).toBe(false);
    expect(adviseDropBackCover({ ...base, bodyPages: 4 })).toBe(false);
  });
});

describe('coverWithoutBack', () => {
  it('뒷표지만 걷고 앞표지는 그대로 둔다', () => {
    const image: PaperCover = {
      ...DEFAULT_SIMPLE_COVER, kind: 'image', imagePath: 'papers/x/cover-a.jpg', backKind: 'image', backImagePath: 'papers/x/cover-b.jpg',
    };
    expect(coverWithoutBack(image)).toEqual({ ...image, backKind: 'none', backImagePath: '' });
    expect(image.backKind).toBe('image');
  });
});
