import { describe, it, expect } from 'vitest';
import { toBbox } from './bbox';

describe('toBbox', () => {
  it('저장 모양({column, top, bottom})을 사각형으로 바꾼다 — 위아래 여유를 붙인다', () => {
    const box = toBbox({ column: 1, top: 0.2, bottom: 0.6 })!;
    // 글자 윗선·아랫선이 잘리지 않게 crop.ts 가 여유를 준다
    expect(box.y).toBeLessThan(0.2);
    expect(box.y + box.h).toBeGreaterThan(0.6);
    // 왼쪽 단이므로 오른쪽 절반까지 덮지 않는다
    expect(box.x + box.w).toBeLessThan(0.6);
  });

  it('이미 정규화된 사각형은 그대로 쓴다', () => {
    expect(toBbox({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 })).toEqual({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 });
  });

  it('폭·높이가 없으면 0 으로 채운다 — 모양이 깨져도 화면이 죽지 않는다', () => {
    expect(toBbox({ x: 0.1, y: 0.2 })).toEqual({ x: 0.1, y: 0.2, w: 0, h: 0 });
  });

  it('알아볼 수 없으면 null (상자를 안 그릴 뿐 본문은 멀쩡하다)', () => {
    expect(toBbox(null)).toBeNull();
    expect(toBbox('{}')).toBeNull();
    expect(toBbox({ foo: 1 })).toBeNull();
  });
});
