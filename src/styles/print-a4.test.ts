import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(path.join(__dirname, 'print-a4.css'), 'utf8');

describe('print-a4.css', () => {
  it('닫을 때까지 떠 있는 안내가 인쇄물에 찍히지 않는다', () => {
    const print = css.slice(css.indexOf('@media print'));
    expect(print).toMatch(/\[data-sonner-toaster\]\s*\{\s*display:\s*none !important;/);
  });

  it('문제지 보기의 가로 스크롤 상자는 화면에서만 가두고 인쇄에서는 푼다(2026-11-22, 코덱스 13R)', () => {
    const print = css.slice(css.indexOf('@media print'));
    const screen = css.slice(0, css.indexOf('@media print'));
    expect(screen).toMatch(/\.a4-scroll-x\s*\{\s*overflow-x:\s*auto;/);
    expect(print).toMatch(/\.a4-scroll-x\s*\{\s*overflow:\s*visible !important;\s*outline:\s*none !important;/);
    // 넘친 낱장을 앞으로 붙이는 것은 화면 전용이다 — 인쇄 배치를 바꾸지 않는다. safe center 는 옛 사파리가 무시해 자동 여백(15R)
    expect(css).toMatch(/@media screen\s*\{\s*\.a4-scroll-x \.a4-stack,\s*\.a4-scroll-x \.booklet-leaf\s*\{\s*align-items:\s*flex-start;\s*\}\s*\.a4-scroll-x \.a4-stack > \*,\s*\.a4-scroll-x \.booklet-leaf > \*\s*\{\s*margin-inline:\s*auto;/);
    expect(css).not.toContain('safe center;');
  });
});
