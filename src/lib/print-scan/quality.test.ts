import { describe, it, expect } from 'vitest';
import { degradedPagesWarning } from './quality';

describe('degradedPagesWarning', () => {
  it('낮춰 보낸 쪽이 없으면 아무 말도 하지 않는다 — 경고가 흔하면 아무도 안 본다', () => {
    expect(degradedPagesWarning([])).toBeNull();
  });

  it('몇 쪽인지와 무엇을 해야 하는지를 함께 말한다', () => {
    const got = degradedPagesWarning([5, 3]);
    expect(got).toContain('3, 5쪽');
    expect(got).toContain('원본과 대조');
  });
});
