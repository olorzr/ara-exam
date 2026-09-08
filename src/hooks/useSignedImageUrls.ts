'use client';

import { useCallback, useEffect, useState } from 'react';
import { signProblemFiles } from '@/lib/problem-bank/storage';

/** 서명 결과와 그 상태 */
export interface SignedImages {
  /** 경로 → 서명 URL */
  urls: Map<string, string>;
  /** 아직 받아 오는 중인가 */
  loading: boolean;
  /**
   * 서명을 받지 못한 경로.
   *
   * ⚠️ 비어 있지 않으면 그 자리의 내용이 **빠진 채로 인쇄된다.**
   *    호출부는 이걸 사람에게 보여 주고 인쇄를 막아야 한다(코덱스 리뷰 7R).
   */
  missing: string[];
  /** 다시 시도 */
  reload: () => void;
}

/**
 * Storage 경로들의 서명 URL 을 **한 번에** 받아 둔다.
 *
 * 버킷이 비공개라 경로만으로는 못 그린다. 인쇄 화면은 수십 장을 쓰므로
 * 낱개로 서명하면 왕복이 그만큼 늘어난다.
 *
 * 서명 URL 은 만료되므로 **DB 에 저장하지 않는다** — 화면이 열릴 때마다 새로 받는다.
 * @param paths - 버킷 기준 경로들
 * @returns 서명 결과와 상태
 */
export function useSignedImageUrls(paths: string[]): SignedImages {
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const [loadedKey, setLoadedKey] = useState<string>('');
  const [attempt, setAttempt] = useState(0);

  // 배열은 렌더마다 새 참조라 그대로 의존성에 넣으면 무한 루프가 된다
  const key = [...new Set(paths.filter(Boolean))].sort().join('|');
  const wanted = key ? key.split('|') : [];

  useEffect(() => {
    // 필요한 이미지가 없으면 아무것도 하지 않는다.
    // (아래 loading 판정이 `key === ''` 를 이미 '다 됐다'로 보므로 state 를 건드릴 필요가 없다)
    if (!key) return;

    let alive = true;
    signProblemFiles(key.split('|'))
      .then((map) => {
        if (!alive) return;
        setUrls(map);
      })
      .finally(() => {
        if (alive) setLoadedKey(key);
      });
    return () => {
      alive = false;
    };
  }, [key, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  // 로딩을 state 로 두고 효과에서 켜면 렌더가 한 번 더 돈다.
  // '무엇을 이미 받아 왔는가'만 기억하고 로딩은 파생한다
  const loading = key !== '' && loadedKey !== key;
  const missing = loading ? [] : wanted.filter((path) => !urls.has(path));

  return { urls, loading, missing, reload };
}
