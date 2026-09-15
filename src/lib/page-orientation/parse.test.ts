import { describe, it, expect } from 'vitest';
import { parseOrientation } from './parse';

const raw = (pages: unknown[]) => JSON.stringify({ pages });

describe('parseOrientation', () => {
  it('순번대로 각도와 글자 유무를 돌려준다', () => {
    const result = parseOrientation(raw([
      { image: 1, rotation: 180, hasText: true },
      { image: 2, rotation: 0, hasText: false },
    ]), 2);
    expect(result).toEqual([
      { rotation: 180, hasText: true },
      { rotation: 0, hasText: false },
    ]);
  });

  it('빠진 이미지는 돌리지 않고 글자가 있다고 본다 — 빈 쪽으로 단정하면 경고가 사라진다', () => {
    const result = parseOrientation(raw([{ image: 2, rotation: 90, hasText: true }]), 3);
    expect(result[0]).toEqual({ rotation: 0, hasText: true });
    expect(result[1]).toEqual({ rotation: 90, hasText: true });
    expect(result[2]).toEqual({ rotation: 0, hasText: true });
  });

  it('모르는 각도는 0 으로 — 엉뚱하게 돌리면 멀쩡한 쪽도 못 읽는다', () => {
    const result = parseOrientation(raw([{ image: 1, rotation: 45, hasText: true }]), 1);
    expect(result[0].rotation).toBe(0);
  });

  it('범위 밖 순번은 버린다 — 보내지 않은 이미지 얘기다', () => {
    const result = parseOrientation(raw([
      { image: 0, rotation: 180, hasText: true },
      { image: 9, rotation: 180, hasText: true },
    ]), 2);
    expect(result.every((r) => r.rotation === 0)).toBe(true);
  });

  it('모양이 깨져도 길이는 지킨다 — 읽기를 막지 않는다(fail-open)', () => {
    expect(parseOrientation('{', 2)).toEqual([
      { rotation: 0, hasText: true }, { rotation: 0, hasText: true },
    ]);
    expect(parseOrientation(JSON.stringify({}), 1)).toEqual([{ rotation: 0, hasText: true }]);
    expect(parseOrientation(raw([]), 0)).toEqual([]);
  });
});
