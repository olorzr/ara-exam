import { describe, expect, it } from 'vitest';
import { detectBrowser, detectSetupOs } from './setupOs';

// 실제 브라우저가 보내는 UA 문자열. 손으로 줄이면 판별이 통과해 버려 의미가 없다.
const UA = {
  winChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
  winEdge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0',
  macChrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
  macFirefox: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:143.0) Gecko/20100101 Firefox/143.0',
  linux:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
};

describe('detectSetupOs', () => {
  it('맥 UA 는 맥 안내를 먼저 편다', () => {
    expect(detectSetupOs(UA.macChrome)).toBe('mac');
    expect(detectSetupOs(UA.macSafari)).toBe('mac');
    expect(detectSetupOs(UA.macFirefox)).toBe('mac');
  });

  it('윈도우 UA 는 윈도우 안내', () => {
    expect(detectSetupOs(UA.winChrome)).toBe('windows');
    expect(detectSetupOs(UA.winEdge)).toBe('windows');
  });

  it('모르는 환경은 윈도우로 떨어진다 — 선생님 대부분이 윈도우다', () => {
    expect(detectSetupOs(UA.linux)).toBe('windows');
    expect(detectSetupOs('')).toBe('windows');
  });

  it('SSR(navigator 없음)에서도 던지지 않는다', () => {
    expect(() => detectSetupOs()).not.toThrow();
    expect(detectSetupOs()).toBe('windows');
  });
});

describe('detectBrowser', () => {
  it('Safari 를 잡는다', () => {
    expect(detectBrowser(UA.macSafari)).toBe('safari');
  });

  it('UA 에 Safari/ 가 든 크로뮴 계열을 Safari 로 오인하지 않는다', () => {
    // 이게 뒤집히면 Chrome 을 쓰는 선생님 전원에게 "Safari 에서는 못 씁니다" 가 나간다.
    expect(detectBrowser(UA.macChrome)).toBe('other');
    expect(detectBrowser(UA.winChrome)).toBe('other');
    expect(detectBrowser(UA.macFirefox)).toBe('other');
    expect(detectBrowser(UA.winEdge)).toBe('other');
  });

  it('SSR 에서도 던지지 않는다', () => {
    expect(() => detectBrowser()).not.toThrow();
    expect(detectBrowser()).toBe('other');
  });
});
