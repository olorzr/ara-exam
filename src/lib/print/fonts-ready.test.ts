import { afterEach, describe, expect, it } from 'vitest';
import { areFontsReady } from './fonts-ready';

const setFonts = (value: unknown) => Object.defineProperty(document, 'fonts', { configurable: true, value });

describe('areFontsReady', () => {
  afterEach(() => { Reflect.deleteProperty(document, 'fonts'); });

  it('글꼴을 받는 중이면 아니다', () => {
    setFonts({ status: 'loading' });
    expect(areFontsReady()).toBe(false);
  });

  it('다 받았으면 그렇다', () => {
    setFonts({ status: 'loaded' });
    expect(areFontsReady()).toBe(true);
  });

  it('글꼴 API 가 없는 환경에서는 끝난 것으로 본다 — 쪼개기가 영영 안 돌면 안 된다', () => {
    expect(areFontsReady()).toBe(true);
  });
});
