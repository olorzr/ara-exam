'use client';

import { useEffect, useState } from 'react';
import { openPdfSource, pdfPagePreview } from '@/lib/pdf/pdfPages';

/**
 * 한 파일에서 그릴 쪽 수의 상한 — 답지는 보통 1~4쪽이다. 넘치면 화면이 '새 탭에서 열기' 를 권한다.
 */
export const PDF_VIEW_MAX_PAGES = 12;

/**
 * 서명 URL 의 PDF 를 쪽마다 그림으로 그린다(읽기 전용 시험 보기의 답지 탭).
 *
 * 왜 `<iframe>` 이 아닌가: 이 앱의 CSP 는 `frame-src` 가 없어 `default-src 'self'` 로 떨어지고 `object-src 'none'` 이라
 * Supabase 서명 URL 을 끼워 넣을 수 없다. 보안 헤더를 넓히지 않고 이미 쓰는 pdf.js(`openPdfSource`)로 그린다 —
 * 내려받기는 `connect-src` 가 연 Supabase 주소다.
 *
 * 규약은 `usePdfPagePreview` 와 같다: 문서는 한 번 열고 끝나면 `destroy`, 로딩은 '무엇을 그렸는가' 에서 파생한다.
 * @param url - 서명 URL. null 이면 아무것도 하지 않는다(서명을 기다리는 중)
 * @returns 쪽 그림(data URL)·전체 쪽 수·로딩·오류
 */
export function usePdfUrlPages(url: string | null) {
  const [stored, setStored] = useState<{ url: string | null; pages: string[]; total: number; error: string | null }>(
    { url: null, pages: [], total: 0, error: null },
  );

  useEffect(() => {
    if (!url) return;
    let alive = true;
    const opening = openPdfSource({ kind: 'url', url });
    opening
      .then(async (doc) => {
        const count = Math.min(doc.numPages, PDF_VIEW_MAX_PAGES);
        const pages: string[] = [];
        for (let page = 1; page <= count && alive; page += 1) pages.push(await pdfPagePreview(doc, page));
        if (alive) setStored({ url, pages, total: doc.numPages, error: null });
      })
      .catch(() => {
        if (alive) setStored({ url, pages: [], total: 0, error: 'PDF 를 그리지 못했어요.' });
      })
      .finally(() => {
        opening.then((doc) => doc.pdf.destroy()).catch(() => undefined);
      });
    return () => { alive = false; };
  }, [url]);

  const ready = url !== null && stored.url === url;
  return {
    pages: ready ? stored.pages : [],
    total: ready ? stored.total : 0,
    loading: url !== null && !ready,
    error: ready ? stored.error : null,
  };
}
