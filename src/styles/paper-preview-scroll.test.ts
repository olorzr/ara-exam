import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(path.join(__dirname, 'paper-preview-scroll.css'), 'utf8');
const printA4 = readFileSync(path.join(__dirname, 'print-a4.css'), 'utf8');
const globals = readFileSync(path.join(__dirname, '../app/globals.css'), 'utf8');

describe('paper-preview-scroll.css — 문제지 미리보기 가로 스크롤 상자 (2026-11-22)', () => {
  it('터치 화면에서만 가두고, 인쇄에서는 푼다(코덱스 13·16R)', () => {
    expect(css).toMatch(/@media screen and \(hover: none\)\s*\{\s*\.a4-scroll-x\s*\{\s*overflow-x:\s*auto;/);
    expect(css).toMatch(/@media print\s*\{\s*\.a4-scroll-x\s*\{\s*overflow:\s*visible !important;\s*outline:\s*none !important;/);
  });

  it('넘친 낱장을 앞으로 붙이는 것은 화면 전용 자동 여백이다 — safe center 는 옛 사파리가 무시한다(15R)', () => {
    expect(css).toMatch(/@media screen\s*\{\s*\.a4-scroll-x \.a4-stack,\s*\.a4-scroll-x \.booklet-leaf\s*\{\s*align-items:\s*flex-start;\s*\}\s*\.a4-scroll-x \.a4-stack > \*,\s*\.a4-scroll-x \.booklet-leaf > \*\s*\{\s*margin-inline:\s*auto;/);
    expect(css).not.toContain('safe center;');
  });

  it('공유 인쇄 엔진 스타일(print-a4.css — 기출 공유 사이트가 옮겨 쓴다)에는 두지 않는다(21R), 앱 전역에서 불러온다', () => {
    expect(printA4).not.toContain('a4-scroll-x');
    expect(globals).toContain('@import "../styles/paper-preview-scroll.css";');
  });
});
