'use client';

import { useEffect, useState } from 'react';
import { signProblemFiles } from '@/lib/problem-bank/storage';

/**
 * Storage 경로들의 서명 URL 을 **한 번에** 받아 둔다.
 *
 * 버킷이 비공개라 경로만으로는 못 그린다. 인쇄 화면은 수십 장을 쓰므로
 * 낱개로 서명하면 왕복이 그만큼 늘어난다.
 *
 * 서명 URL 은 만료되므로 **DB 에 저장하지 않는다** — 화면이 열릴 때마다 새로 받는다.
 * @param paths - 버킷 기준 경로들
 * @returns 경로 → URL 맵 (아직 못 받았거나 실패한 경로는 빠진다)
 */
export function useSignedImageUrls(paths: string[]): Map<string, string> {
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  // 배열은 렌더마다 새 참조라 그대로 의존성에 넣으면 무한 루프가 된다
  const key = paths.filter(Boolean).sort().join('|');

  useEffect(() => {
    if (!key) {
      return;
    }
    let alive = true;
    signProblemFiles(key.split('|')).then((map) => {
      if (alive) setUrls(map);
    });
    return () => {
      alive = false;
    };
  }, [key]);

  return urls;
}
