import { describe, expect, it } from 'vitest';
import { A4_HEIGHT_PX, A4_WIDTH_PX, MM_TO_PX } from './constants';

describe('MM_TO_PX', () => {
  it('A4 px 상수와 mm 환산이 0.01px 안에서 같다 — 책 표지 펼침면에 A4 표지를 그대로 넣는 근거', () => {
    expect(Math.abs(210 * MM_TO_PX - A4_WIDTH_PX)).toBeLessThan(0.01);
    expect(Math.abs(297 * MM_TO_PX - A4_HEIGHT_PX)).toBeLessThan(0.01);
  });
});
