'use client';

import { useEffect, useState } from 'react';

/** 실제 이미지 로딩 상태 */
export interface ImagesReady {
  /** 아직 받아 오는 중인가 */
  loading: boolean;
  /** 끝내 못 받은 URL — 있으면 그 자리가 깨진 채 인쇄된다 */
  failed: string[];
}

/**
 * 인쇄 전에 이미지를 **미리 받아 두고** 실제로 그려지는지 확인한다.
 *
 * ⚠️ 서명 URL 을 받았다고 그림이 뜨는 것은 아니다 — 그 뒤의 요청이 실패하면
 *    (네트워크 끊김·만료·객체 없음) 깨진 이미지가 그대로 인쇄된다.
 *    이미지로 출제한 문항은 그 그림이 본문 전체라 문항이 통째로 사라지는 셈이다
 *    (코덱스 리뷰 11R). 브라우저가 캐시하므로 미리 받아 두는 비용은 사실상 없다.
 * @param urls - 확인할 이미지 URL
 * @returns 로딩·실패 상태
 */
export function useImagesReady(urls: string[]): ImagesReady {
  const [doneKey, setDoneKey] = useState('');
  const [failed, setFailed] = useState<string[]>([]);

  const key = [...new Set(urls.filter(Boolean))].sort().join('|');

  useEffect(() => {
    if (!key) return;
    let alive = true;

    const list = key.split('|');
    Promise.all(list.map((url) => new Promise<string | null>((resolve) => {
      const img = new window.Image();
      img.onload = () => resolve(null);
      img.onerror = () => resolve(url);
      img.src = url;
    }))).then((results) => {
      if (!alive) return;
      setFailed(results.filter((r): r is string => r !== null));
      setDoneKey(key);
    });

    return () => {
      alive = false;
    };
  }, [key]);

  return { loading: key !== '' && doneKey !== key, failed };
}
