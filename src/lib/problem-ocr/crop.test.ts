import { describe, it, expect } from 'vitest';
import { bboxToPixelRect, boxToBbox, boxToPixelRect, pixelRectToBbox } from './crop';

describe('boxToBbox', () => {
  it('전체 폭(column 0)은 가로를 다 쓴다', () => {
    const b = boxToBbox({ column: 0, top: 0.2, bottom: 0.5 });
    expect(b.x).toBe(0);
    expect(b.w).toBe(1);
  });

  it('왼쪽 단은 왼쪽 절반에서 여백만큼 뺀다 — 오른쪽 단 글자가 딸려 오지 않게', () => {
    const b = boxToBbox({ column: 1, top: 0, bottom: 1 });
    expect(b.x).toBe(0);
    expect(b.w).toBeLessThan(0.5);
  });

  it('오른쪽 단은 절반보다 오른쪽에서 시작한다', () => {
    const b = boxToBbox({ column: 2, top: 0, bottom: 1 });
    expect(b.x).toBeGreaterThan(0.5);
    expect(b.x + b.w).toBeLessThanOrEqual(1);
  });

  it('위아래로 여유를 준다 — 글자 윗선이 잘리지 않게', () => {
    const b = boxToBbox({ column: 0, top: 0.3, bottom: 0.4 });
    expect(b.y).toBeLessThan(0.3);
    expect(b.y + b.h).toBeGreaterThan(0.4);
  });

  it('쪽 밖으로 나가지 않는다', () => {
    const b = boxToBbox({ column: 0, top: 0, bottom: 1 });
    expect(b.y).toBe(0);
    expect(b.y + b.h).toBeCloseTo(1, 5);
  });

  it('위아래가 뒤집혀 있어도 바로잡는다', () => {
    const b = boxToBbox({ column: 0, top: 0.8, bottom: 0.2 });
    expect(b.h).toBeGreaterThan(0.5);
  });
});

describe('boxToPixelRect', () => {
  it('캔버스 크기에 맞춘 정수 사각형을 준다', () => {
    const r = boxToPixelRect({ column: 0, top: 0.25, bottom: 0.75 }, 1000, 1400);
    expect(Number.isInteger(r.x)).toBe(true);
    expect(Number.isInteger(r.h)).toBe(true);
    expect(r.w).toBe(1000);
  });

  it('캔버스를 넘지 않는다 — drawImage 가 빈 영역을 그리지 않게', () => {
    const r = boxToPixelRect({ column: 2, top: 0, bottom: 1 }, 1000, 1400);
    expect(r.x + r.w).toBeLessThanOrEqual(1000);
    expect(r.y + r.h).toBeLessThanOrEqual(1400);
  });

  it('아주 얇은 구간도 최소 1px 은 준다', () => {
    const r = boxToPixelRect({ column: 0, top: 0.5, bottom: 0.5001 }, 100, 100);
    expect(r.h).toBeGreaterThanOrEqual(1);
  });
});

describe('bbox ↔ 픽셀 왕복', () => {
  it('검수에서 끌어 옮긴 사각형이 저장·복원을 거쳐도 거의 같다', () => {
    const rect = { x: 120, y: 300, w: 400, h: 250 };
    const bbox = pixelRectToBbox(rect, 1000, 1400);
    const back = bboxToPixelRect(bbox, 1000, 1400);
    expect(back.x).toBe(rect.x);
    expect(back.y).toBe(rect.y);
    expect(Math.abs(back.w - rect.w)).toBeLessThanOrEqual(1);
    expect(Math.abs(back.h - rect.h)).toBeLessThanOrEqual(1);
  });

  it('캔버스 크기가 0 이어도 터지지 않는다', () => {
    expect(pixelRectToBbox({ x: 0, y: 0, w: 10, h: 10 }, 0, 0)).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('저장값이 범위를 벗어나 있어도 가둔다', () => {
    const r = bboxToPixelRect({ x: -1, y: 2, w: 5, h: 5 }, 800, 600);
    expect(r.x).toBe(0);
    expect(r.x + r.w).toBeLessThanOrEqual(800);
  });
});
