import { describe, it, expect } from 'vitest';
import { autoScrollStep, dropIndexFromPointer, isInside, moveTargetIndex } from './dnd';

const rects = [
  { top: 0, height: 100 },
  { top: 100, height: 100 },
  { top: 200, height: 100 },
];

describe('dropIndexFromPointer', () => {
  it('첫 줄 위 절반이면 맨 앞', () => {
    expect(dropIndexFromPointer(rects, 10)).toBe(0);
    expect(dropIndexFromPointer(rects, 49)).toBe(0);
  });

  it('중간점을 넘으면 그 줄 뒤', () => {
    expect(dropIndexFromPointer(rects, 51)).toBe(1);
    expect(dropIndexFromPointer(rects, 151)).toBe(2);
  });

  it('마지막 줄 아래면 맨 뒤', () => {
    expect(dropIndexFromPointer(rects, 999)).toBe(3);
  });

  it('빈 캔버스면 0', () => {
    expect(dropIndexFromPointer([], 100)).toBe(0);
  });

  it('음수 좌표도 맨 앞으로 본다', () => {
    expect(dropIndexFromPointer(rects, -50)).toBe(0);
  });
});

describe('moveTargetIndex', () => {
  it('뒤로 옮길 때 자기 자리를 뺀 만큼 보정한다 — 없으면 늘 한 칸 앞에 떨어진다', () => {
    expect(moveTargetIndex(0, 3)).toBe(2);
  });

  it('앞으로 옮길 때는 보정하지 않는다', () => {
    expect(moveTargetIndex(3, 1)).toBe(1);
  });

  it('제자리면 그대로', () => {
    expect(moveTargetIndex(2, 2)).toBe(2);
  });
});

describe('isInside', () => {
  const box = { left: 100, top: 100, right: 300, bottom: 400 };

  it('안이면 true, 밖이면 false', () => {
    expect(isInside(box, 200, 200)).toBe(true);
    expect(isInside(box, 50, 200)).toBe(false);
    expect(isInside(box, 200, 500)).toBe(false);
  });

  it('경계는 안으로 본다', () => {
    expect(isInside(box, 100, 100)).toBe(true);
    expect(isInside(box, 300, 400)).toBe(true);
  });
});

describe('autoScrollStep', () => {
  const box = { top: 100, bottom: 500 };

  it('가운데서는 굴리지 않는다', () => {
    expect(autoScrollStep(box, 300)).toBe(0);
  });

  it('위 가장자리에서는 음수(위로)', () => {
    expect(autoScrollStep(box, 105)).toBeLessThan(0);
  });

  it('아래 가장자리에서는 양수(아래로)', () => {
    expect(autoScrollStep(box, 495)).toBeGreaterThan(0);
  });

  it('가장자리에 가까울수록 빠르다', () => {
    expect(Math.abs(autoScrollStep(box, 101))).toBeGreaterThan(Math.abs(autoScrollStep(box, 135)));
  });

  it('영역 밖으로 나가도 최대 속도를 넘지 않는다', () => {
    expect(Math.abs(autoScrollStep(box, -500))).toBeLessThanOrEqual(18);
    expect(Math.abs(autoScrollStep(box, 5000))).toBeLessThanOrEqual(18);
  });
});
