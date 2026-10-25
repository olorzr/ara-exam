'use client';

import { useMemo } from 'react';
import type { PaperCover } from '@/lib/problem-paper/cover';
import { useImagesReady } from './useImagesReady';
import { useSignedImageUrls } from './useSignedImageUrls';

/** 앞·뒷표지 그림의 서명 URL 과 준비 상태 */
export interface CoverImagesState {
  /** 그림 앞표지의 서명 URL */
  frontUrl?: string;
  /** 그림 뒷표지의 서명 URL */
  backUrl?: string;
  /** 그림을 받는 중인가(그림이 없으면 false) */
  pending: boolean;
  /** 그림 앞표지를 끝내 못 받았는가 */
  frontBroken: boolean;
  /** 그림 뒷표지를 끝내 못 받았는가 */
  backBroken: boolean;
  /** 둘 중 하나라도 깨졌는가 — 인쇄를 막는다 */
  broken: boolean;
  /** 다시 서명한다 */
  reload: () => void;
}

/**
 * 표지 그림(앞·뒤)을 서명하고 실제로 뜨는지 확인한다.
 *
 * ⚠️ 문항 이미지와 **따로** 둔다 — 한 묶음이면 답지 모드에서도 화면에 없는 문항 그림 때문에 인쇄가 막힌다.
 *    앞·뒤 어느 그림이 안 왔거나 깨져도 첫 장·끝 장이 빈 종이로 나가므로 호출부가 인쇄를 막는다.
 * ⚠️ 깨짐은 **지금 URL** 이 실패했는지로 본다 — `failed` 는 앞 그림의 결과를 들고 있을 수 있다.
 * @param cover - 표지 (없으면 null)
 * @returns 그림 상태
 */
export function useCoverImages(cover: PaperCover | null): CoverImagesState {
  const frontPath = cover?.kind === 'image' ? cover.imagePath : '';
  const backPath = cover?.backKind === 'image' ? cover.backImagePath : '';
  const paths = useMemo(() => [frontPath, backPath].filter(Boolean), [frontPath, backPath]);
  const signed = useSignedImageUrls(paths);
  const frontUrl = frontPath ? signed.urls.get(frontPath) : undefined;
  const backUrl = backPath ? signed.urls.get(backPath) : undefined;
  const ready = useImagesReady(useMemo(() => [frontUrl, backUrl].filter((u): u is string => Boolean(u)), [frontUrl, backUrl]));

  const brokenOf = (path: string, url: string | undefined) => Boolean(path) && (
    signed.missing.includes(path) || (Boolean(url) && !ready.loading && ready.failed.includes(url ?? ''))
  );
  const frontBroken = brokenOf(frontPath, frontUrl);
  const backBroken = brokenOf(backPath, backUrl);
  return {
    frontUrl,
    backUrl,
    pending: paths.length > 0 && (signed.loading || ready.loading),
    frontBroken,
    backBroken,
    broken: frontBroken || backBroken,
    reload: signed.reload,
  };
}
