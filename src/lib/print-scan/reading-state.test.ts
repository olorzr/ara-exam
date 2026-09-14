import { describe, it, expect } from 'vitest';
import { PRINT_READ_STALE_MS } from './constants';
import { bundleWarnings, isStalledReading } from './reading-state';

const NOW = Date.parse('2026-09-14T10:00:00.000Z');
const at = (ms: number) => new Date(NOW - ms).toISOString();

describe('isStalledReading', () => {
  it("'읽는중' 이 아니면 언제 갱신됐든 멈춘 게 아니다", () => {
    for (const status of ['대기', '읽기완료', '실패'] as const) {
      expect(isStalledReading({ status, updated_at: at(PRINT_READ_STALE_MS * 10) }, NOW)).toBe(false);
    }
  });

  it('방금 시작한 읽기는 살아 있는 것으로 본다 (다른 탭이 읽는 중)', () => {
    expect(isStalledReading({ status: '읽는중', updated_at: at(60_000) }, NOW)).toBe(false);
  });

  it('상한을 넘기면 멈춘 것으로 본다 — 탭이 닫히면 정리가 못 돈다', () => {
    expect(isStalledReading({ status: '읽는중', updated_at: at(PRINT_READ_STALE_MS) }, NOW)).toBe(true);
    expect(isStalledReading({ status: '읽는중', updated_at: at(PRINT_READ_STALE_MS + 1) }, NOW)).toBe(true);
  });

  it('시각을 못 읽으면 멈춘 것으로 본다 — 영영 잠긴 줄보다 낫다', () => {
    expect(isStalledReading({ status: '읽는중', updated_at: '' }, NOW)).toBe(true);
    expect(isStalledReading({ status: '읽는중', updated_at: '어제' }, NOW)).toBe(true);
  });

  it('기기 시계가 앞서 있어도 멈췄다고 하지 않는다', () => {
    expect(isStalledReading({ status: '읽는중', updated_at: at(-PRINT_READ_STALE_MS * 3) }, NOW)).toBe(false);
  });
});

describe('bundleWarnings', () => {
  it('ocr_meta 가 없거나 비어 있어도 배열을 돌려준다', () => {
    expect(bundleWarnings({ ocr_meta: undefined as never })).toEqual([]);
    expect(bundleWarnings({ ocr_meta: null as never })).toEqual([]);
    expect(bundleWarnings({ ocr_meta: {} })).toEqual([]);
  });

  it('저장된 경고를 그대로 돌려준다', () => {
    expect(bundleWarnings({ ocr_meta: { warnings: ['3쪽이 흐려요'] } })).toEqual(['3쪽이 흐려요']);
  });
});
