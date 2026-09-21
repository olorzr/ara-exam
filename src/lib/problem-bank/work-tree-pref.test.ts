import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readWorkTreeOrder, writeWorkTreeOrder } from './work-tree-pref';

/**
 * ⚠️ 이 테스트 환경의 `window.localStorage` 는 **메서드가 없는 빈 객체**다(jsdom 28 + vitest 4).
 *    그대로 두면 모든 호출이 예외로 떨어져 '기본값' 만 확인하게 되므로, 진짜 저장소를 흉내 내
 *    읽기·쓰기 경로를 본다. 접근 자체가 막히는 경우는 마지막 테스트가 따로 본다.
 */
function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => { map.delete(k); },
    setItem: (k: string, v: string) => { map.set(k, v); },
  };
}

function setStorage(value: unknown) {
  Object.defineProperty(window, 'localStorage', {
    value, configurable: true, writable: true,
  });
}

const original = Object.getOwnPropertyDescriptor(window, 'localStorage');

describe('work-tree-pref', () => {
  beforeEach(() => setStorage(fakeStorage()));
  afterEach(() => {
    if (original) Object.defineProperty(window, 'localStorage', original);
  });

  it('저장된 것이 없으면 기본 정렬(지은이순)이다', () => {
    expect(readWorkTreeOrder()).toBe('author');
  });

  it('쓴 값을 그대로 읽는다 — 새로고침해도 고른 정렬이 남는다', () => {
    writeWorkTreeOrder('title');
    expect(readWorkTreeOrder()).toBe('title');
  });

  it('모르는 값이 저장돼 있으면 기본 정렬로 떨어진다', () => {
    window.localStorage.setItem('ara-work-tree-order', 'count');
    expect(readWorkTreeOrder()).toBe('author');
  });

  it('모르는 값은 저장하지 않는다 — 앞서 고른 것을 덮지 않는다', () => {
    writeWorkTreeOrder('title');
    writeWorkTreeOrder('count' as never);
    expect(readWorkTreeOrder()).toBe('title');
  });

  it('저장소 접근이 막혀도(시크릿 모드) 던지지 않고 기본값으로 돈다', () => {
    setStorage({
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    });
    expect(readWorkTreeOrder()).toBe('author');
    expect(() => writeWorkTreeOrder('title')).not.toThrow();
  });
});
