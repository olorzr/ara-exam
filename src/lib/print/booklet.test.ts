import { describe, expect, it } from 'vitest';
import { bookletSheetCount, bookletSheets, type BookletSheet } from './booklet';

/** 1-based 로 적은 배치를 0-based 로 (빈 면은 0 → null) */
function sheet(front: [number, number], back: [number, number]): BookletSheet {
  const z = (n: number) => (n === 0 ? null : n - 1);
  return { front: [z(front[0]), z(front[1])], back: [z(back[0]), z(back[1])] };
}

describe('bookletSheets', () => {
  it('4쪽 — 한 장, 앞(4,1) 뒤(2,3)', () => {
    expect(bookletSheets(4)).toEqual([sheet([4, 1], [2, 3])]);
  });

  it('8쪽 — 1장 앞(8,1) 뒤(2,7), 2장 앞(6,3) 뒤(4,5)', () => {
    expect(bookletSheets(8)).toEqual([
      sheet([8, 1], [2, 7]),
      sheet([6, 3], [4, 5]),
    ]);
  });

  it('12쪽 — 가운데 장이 6·7쪽을 마주 본다', () => {
    expect(bookletSheets(12)).toEqual([
      sheet([12, 1], [2, 11]),
      sheet([10, 3], [4, 9]),
      sheet([8, 5], [6, 7]),
    ]);
  });

  it('5쪽 — 8쪽으로 올리고 남는 6·7·8쪽 자리는 빈 면이다(끝에만 생긴다)', () => {
    expect(bookletSheets(5)).toEqual([
      sheet([0, 1], [2, 0]),
      sheet([0, 3], [4, 5]),
    ]);
  });

  it('1쪽 — 앞면 오른쪽만 차고 나머지는 빈 면', () => {
    expect(bookletSheets(1)).toEqual([sheet([0, 1], [0, 0])]);
  });

  it('0쪽이나 이상한 값은 장이 없다', () => {
    expect(bookletSheets(0)).toEqual([]);
    expect(bookletSheets(-3)).toEqual([]);
    expect(bookletSheets(Number.NaN)).toEqual([]);
    expect(bookletSheetCount(0)).toBe(0);
  });

  it('1~40쪽 — 모든 쪽이 정확히 한 번, 짝의 합은 total-1, 앞면 오른쪽 뒤는 다음 쪽', () => {
    for (let n = 1; n <= 40; n++) {
      const sheets = bookletSheets(n);
      expect(sheets).toHaveLength(bookletSheetCount(n));
      const total = sheets.length * 4;
      const seen: number[] = [];
      sheets.forEach((s, k) => {
        expect(s.front[1]).toBe(2 * k < n ? 2 * k : null);
        expect(s.back[0]).toBe(2 * k + 1 < n ? 2 * k + 1 : null);
        const raw = (pair: [number | null, number | null], fallback: [number, number]) =>
          pair.map((v, i) => v ?? fallback[i]);
        const front = raw(s.front, [total - 1 - 2 * k, 2 * k]);
        const back = raw(s.back, [2 * k + 1, total - 2 - 2 * k]);
        expect(front[0] + front[1]).toBe(total - 1);
        expect(back[0] + back[1]).toBe(total - 1);
        for (const v of [...s.front, ...s.back]) if (v !== null) seen.push(v);
      });
      expect(seen.sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i));
    }
  });
});
