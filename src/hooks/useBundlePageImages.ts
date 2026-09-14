'use client';

import { useEffect, useState } from 'react';
import { fetchBundle } from '@/lib/print-scan/queries';
import { fetchSheetIdForBundle } from '@/lib/print-scan/save';
import type { PrintBundle, PrintScan } from '@/types/print-scan';
import { useSignedImageUrls, type SignedImages } from './useSignedImageUrls';

/**
 * 프린트 시험지 화면이 필요한 것 — 묶음·스캔·시험지 id·원본 쪽 이미지.
 *
 * 시험지 id 를 **먼저** 알아야 편집기 훅을 부를 수 있어서(훅은 조건부로 못 부른다)
 * 한 곳에서 모아 읽는다.
 */
export interface BundleWorkspaceData {
  bundle: PrintBundle | null;
  scan: PrintScan | null;
  /** 이 묶음의 개념지 id. 아직 안 만들었으면 null */
  sheetId: string | null;
  loading: boolean;
  error: string | null;
  images: SignedImages;
}

export function useBundlePageImages(bundleId: string): BundleWorkspaceData {
  const [bundle, setBundle] = useState<PrintBundle | null>(null);
  const [scan, setScan] = useState<PrintScan | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const found = await fetchBundle(bundleId);
        if (!alive) return;
        if (!found) {
          setError('프린트를 찾을 수 없어요.');
          return;
        }
        setBundle(found.bundle);
        setScan(found.scan);
        setSheetId(await fetchSheetIdForBundle(bundleId));
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : '불러오지 못했어요.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [bundleId]);

  // 비어 있는 자리(올리지 못한 쪽)는 서명할 것이 없다 — 화면이 '이미지 없음' 으로 그린다
  const images = useSignedImageUrls(bundle?.page_paths.filter(Boolean) ?? []);

  return { bundle, scan, sheetId, loading, error, images };
}
