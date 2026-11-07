'use client';

import { useEffect, type RefObject } from 'react';
import { layoutPhraseNotes, layoutPhraseNotesForPrint } from '@/lib/reference-texts/phrase-note-dom';
import { useIsoLayoutEffect } from './useIsoLayoutEffect';

/**
 * 본문의 구절 풀이 자리를 잡고 지킨다 — 그리기 전에 한 번, 그 뒤로는 줄바꿈이 바뀔 때마다.
 *
 * 다시 재는 때는 글꼴이 왔을 때(한글 글꼴은 글자가 처음 그려질 때 조각을 받는다), 폭이 바뀌었을 때, 인쇄 앞뒤다.
 * ⚠️ 높이 변화로는 다시 재지 않는다 — 받침이 높이를 바꾸므로 되먹임이 된다. 폭만 본다.
 * 인쇄는 폭과 글자 크기가 달라 `beforeprint` 에서 인쇄 치수로 재고 `afterprint` 에서 화면 치수로 되돌린다.
 * @param rootRef - 본문 뿌리
 * @param html - 그린 본문 — 바뀌면 `dangerouslySetInnerHTML` 이 안을 통째로 갈아 끼우므로 다시 잰다.
 *   ⚠️ 부르는 쪽은 `dangerouslySetInnerHTML` 객체를 메모해야 한다. 같은 글로 다시 그릴 때 안이 갈리면 여기서는 알 길이 없다
 */
export function usePhraseNoteLayout(rootRef: RefObject<HTMLElement | null>, html: string): void {
  useIsoLayoutEffect(() => {
    if (rootRef.current) layoutPhraseNotes(rootRef.current);
  }, [rootRef, html]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !root.querySelector('span[data-note]')) return;

    let printing = false;
    let frame = 0;
    let width = root.getBoundingClientRect().width;
    const relayout = () => {
      if (!printing) layoutPhraseNotes(root);
    };
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = root.getBoundingClientRect().width;
        if (next === 0 || next === width) return;
        width = next;
        relayout();
      });
    };
    const beforePrint = () => {
      printing = true;
      layoutPhraseNotesForPrint(root);
    };
    const afterPrint = () => {
      printing = false;
      relayout();
    };

    const fonts = document.fonts;
    let live = true;
    fonts?.ready.then(() => { if (live) relayout(); }).catch(() => {});
    fonts?.addEventListener?.('loadingdone', relayout);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onResize);
    observer?.observe(root);
    window.addEventListener('beforeprint', beforePrint);
    window.addEventListener('afterprint', afterPrint);

    return () => {
      live = false;
      cancelAnimationFrame(frame);
      fonts?.removeEventListener?.('loadingdone', relayout);
      observer?.disconnect();
      window.removeEventListener('beforeprint', beforePrint);
      window.removeEventListener('afterprint', afterPrint);
    };
  }, [rootRef, html]);
}
