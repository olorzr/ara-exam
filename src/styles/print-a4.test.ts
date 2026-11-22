import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(path.join(__dirname, 'print-a4.css'), 'utf8');

describe('print-a4.css', () => {
  it('닫을 때까지 떠 있는 안내가 인쇄물에 찍히지 않는다', () => {
    const print = css.slice(css.indexOf('@media print'));
    expect(print).toMatch(/\[data-sonner-toaster\]\s*\{\s*display:\s*none !important;/);
  });
});
