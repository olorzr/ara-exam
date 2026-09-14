import { describe, it, expect } from 'vitest';
import { passCountOf, clampPassPercentage } from './pass-count';

describe('passCountOf', () => {
  it('올림한다 — 80% 17문항이면 14개', () => {
    expect(passCountOf(80, 17)).toBe(14);
    expect(passCountOf(80, 20)).toBe(16);
    expect(passCountOf(80, 10)).toBe(8);
  });
  it('0% 는 0개, 100% 는 전부', () => {
    expect(passCountOf(0, 20)).toBe(0);
    expect(passCountOf(100, 20)).toBe(20);
  });
  it('문항이 없으면 0', () => {
    expect(passCountOf(80, 0)).toBe(0);
    expect(passCountOf(80, -3)).toBe(0);
  });
  it('범위 밖 백분율은 잘라 쓴다', () => {
    expect(passCountOf(150, 20)).toBe(20);
    expect(passCountOf(-10, 20)).toBe(0);
  });
  it('딱 떨어지는 기준에서 부동소수 오차로 하나 더 올라가지 않는다', () => {
    // (55/100)*100 은 55.00000000000001 이라 그대로 올리면 56 이 된다 — Postgres numeric 은 55.
    expect(passCountOf(55, 100)).toBe(55);
    expect(passCountOf(29, 100)).toBe(29);
    expect(passCountOf(7, 700)).toBe(49);
    expect(passCountOf(35, 20)).toBe(7);
  });

  it('숫자가 아니면 0', () => {
    expect(passCountOf(NaN, 20)).toBe(0);
    expect(passCountOf(80, NaN)).toBe(0);
  });
});

describe('clampPassPercentage', () => {
  it('정수로 잘라 담는다', () => {
    expect(clampPassPercentage('80', 80)).toBe(80);
    expect(clampPassPercentage(79.6, 80)).toBe(80);
    expect(clampPassPercentage(120, 80)).toBe(100);
    expect(clampPassPercentage(-5, 80)).toBe(0);
  });
  it('빈 값·문자는 기본값', () => {
    expect(clampPassPercentage('', 80)).toBe(80);
    expect(clampPassPercentage(null, 70)).toBe(70);
    expect(clampPassPercentage('abc', 80)).toBe(80);
  });
});
