import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDocumentFontsReady } from './useDocumentFontsReady';

/** document.fonts 대역 — 상태와 loading/loadingdone 이벤트만 흉내 낸다 */
class FakeFonts extends EventTarget {
  status: FontFaceSetLoadStatus = 'loaded';
  set(status: FontFaceSetLoadStatus) {
    this.status = status;
    this.dispatchEvent(new Event(status === 'loading' ? 'loading' : 'loadingdone'));
  }
}

const original = Object.getOwnPropertyDescriptor(document, 'fonts');
afterEach(() => {
  if (original) Object.defineProperty(document, 'fonts', original);
  else delete (document as { fonts?: unknown }).fonts;
});

describe('useDocumentFontsReady', () => {
  it('처음에 다 왔어도 나중에 글꼴 조각을 받는 동안은 false 로 돌아간다', () => {
    const fonts = new FakeFonts();
    Object.defineProperty(document, 'fonts', { configurable: true, value: fonts });
    const { result } = renderHook(() => useDocumentFontsReady());
    expect(result.current).toBe(true);
    act(() => fonts.set('loading'));
    expect(result.current).toBe(false);
    act(() => fonts.set('loaded'));
    expect(result.current).toBe(true);
  });

  it('document.fonts 가 없으면 왔다고 본다', () => {
    Object.defineProperty(document, 'fonts', { configurable: true, value: undefined });
    const { result } = renderHook(() => useDocumentFontsReady());
    expect(result.current).toBe(true);
  });
});
