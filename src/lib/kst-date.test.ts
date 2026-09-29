import { describe, it, expect } from 'vitest';
import { toKstDate } from './kst-date';

describe('toKstDate', () => {
  it('UTC 자정 전후를 한국 날짜로 바꾼다', () => {
    expect(toKstDate('2026-09-28T15:30:00Z')).toBe('2026-09-29'); // KST 00:30
    expect(toKstDate('2026-09-28T14:59:00Z')).toBe('2026-09-28'); // KST 23:59
  });

  it('없거나 읽을 수 없으면 null', () => {
    expect(toKstDate(null)).toBeNull();
    expect(toKstDate('어제')).toBeNull();
  });
});
