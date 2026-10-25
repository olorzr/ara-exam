'use client';

import { useSyncExternalStore } from 'react';

function fontSet(): FontFaceSet | null {
  if (typeof document === 'undefined') return null;
  return document.fonts ?? null;
}

function subscribe(onChange: () => void): () => void {
  const fonts = fontSet();
  if (!fonts || typeof fonts.addEventListener !== 'function') return () => {};
  const events = ['loading', 'loadingdone', 'loadingerror'] as const;
  events.forEach((e) => fonts.addEventListener(e, onChange));
  return () => events.forEach((e) => fonts.removeEventListener(e, onChange));
}

function snapshot(): boolean {
  const fonts = fontSet();
  return !fonts || fonts.status === 'loaded';
}

/**
 * 문서의 웹 글꼴이 **지금** 다 와 있는가 — 책 내지의 쪽 수를 믿어도 되는 때를 가린다.
 *
 * 글꼴이 바뀌면 줄바꿈이 바뀌어 엔진이 다시 재고 쪽 수가 달라진다. 한글 글꼴은 글자가 처음 그려질 때 그 조각을
 * 받으므로, 처음에 다 왔어도 **장 본문이 나중에 그려지며 또 받는다**(코덱스 1R). 그래서 한 번 왔다고 굳히지 않고
 * `document.fonts` 의 loading·loadingdone 마다 다시 읽는다 — 받는 동안은 false 다.
 * `document.fonts` 가 없으면(옛 브라우저·테스트) 왔다고 본다.
 * @returns 지금 받는 글꼴이 없으면 true
 */
export function useDocumentFontsReady(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => true);
}
