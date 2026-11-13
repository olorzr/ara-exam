import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { badgeVariants } from './badge';

/**
 * 꼬리표가 화면마다 갈라지지 않게 지킨다(2026-11-13 — 원장님 "OMR 이나 이런 뱃지들이 다 옛날 느낌이야").
 * 예전에는 쓰는 곳마다 `bg-amber-500 text-white`·`bg-sky-500`·`text-[10px]` 를 덮어 꼬리표가 제각각이었다.
 * 색·크기는 갈래(variant)로만 고르고, className 에는 자리(ml-*·align-*) 같은 배치만 둔다.
 */

const SRC = join(__dirname, '..', '..');

/** src 아래 .tsx 전부(테스트 제외) */
function tsxFiles(): string[] {
  return (readdirSync(SRC, { recursive: true }) as string[])
    .filter((f) => f.endsWith('.tsx') && !f.includes('.test.'))
    .map((f) => join(SRC, f));
}

/** 색·크기·안쪽 여백을 덮는 유틸리티 */
const OVERRIDE = /(^|\s)(bg-|text-(?:xs|sm|white|black|\[|gray-|amber-|sky-|primary|red-|green-)|border-(?:gray|amber|sky|primary|red|transparent)|p[xy]?-|h-\d|rounded(?:\s|$|-))/;

describe('Badge', () => {
  it('쓰는 곳에서 색·크기를 className 으로 덮지 않는다 — 갈래(variant)를 쓴다', () => {
    const offenders: string[] = [];
    for (const file of tsxFiles()) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(/<Badge\b[^>]*?className="([^"]*)"/g)) {
        if (OVERRIDE.test(match[1])) offenders.push(`${file.slice(SRC.length + 1)}: ${match[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('상태 갈래와 덜 중요한 수 갈래가 있다', () => {
    for (const variant of ['default', 'outline', 'secondary', 'muted', 'ok', 'warn', 'danger', 'info'] as const) {
      expect(badgeVariants({ variant })).toContain('border');
    }
    // 주 꼬리표는 잉크 — 주 단추와 같은 색(0.9.82)
    expect(badgeVariants()).toContain('bg-ink');
    expect(badgeVariants()).toContain('font-tag');
  });
});
