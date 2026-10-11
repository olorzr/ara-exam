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
 * 경로 목록 → 순서·중복과 무관한 열쇠 글자.
 * ⚠️ 훅 밖에 둔다 — 안에서 `.sort()` 로 만들면 React Compiler 가 '바뀔 수 있는 값' 으로 보고
 *    그 값을 쓰는 `useMemo` 를 포기한다(`react-hooks/preserve-manual-memoization`, 코덱스 4R).
 * @param paths - 버킷 기준 경로들
 * @returns `'a|b'` (없으면 `''`)
 */
function pathsKey(paths: readonly string[]): string {
  return [...new Set(paths.filter(Boolean))].sort().join('|');
}

/** 바라는 경로가 없을 때 내주는 지도 — 렌더마다 새 지도를 만들지 않으려고 하나를 돌려 쓴다 */
const EMPTY_URLS: Map<string, string> = new Map();

/**
 * 받아 둔 지도에서 **지금 바라는 경로만** 남긴다.
 *
 * `useMemo` 로 거르지 않는다 — React Compiler 린트가 그 기억을 지킬 수 없다고 거부한다(코덱스 4R).
 * 대신 **참조를 아낀다**: 지도가 이미 바라는 경로만 담고 있으면(평소) 그 지도를 그대로, 아무것도
 * 안 바라면 늘 같은 빈 지도를 내준다. 새 지도는 바라는 경로가 줄어 다시 서명하는 짧은 틈에만 생긴다.
 * @param urls - 마지막으로 받아 둔 지도
 * @param wanted - 지금 바라는 경로들
 * @returns 바라는 경로만 담은 지도
 */
function onlyWanted(urls: Map<string, string>, wanted: readonly string[]): Map<string, string> {
  if (wanted.length === 0) return EMPTY_URLS;
  const want = new Set(wanted);
  if ([...urls.keys()].every((path) => want.has(path))) return urls;
  return new Map([...urls].filter(([path]) => want.has(path)));
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
  const key = pathsKey(paths);
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

  // ⚠️ 돌려주는 지도는 **지금 바라는 경로만** 담는다(코덱스 2R). 받아 둔 지도를 그대로 내주면
  //    바라는 경로가 줄었을 때(문제지에서 구역을 빼 그림이 필요 없어졌다) 옛 URL 이 남아, 그걸로
  //    로딩을 확인하는 쪽(`useImagesReady`)이 인쇄하지도 않을 그림의 실패로 단추를 잠근다
  const current = onlyWanted(urls, wanted);

  // 로딩을 state 로 두고 효과에서 켜면 렌더가 한 번 더 돈다.
  // '무엇을 이미 받아 왔는가'만 기억하고 로딩은 파생한다
  const loading = key !== '' && loadedKey !== key;
  const missing = loading ? [] : wanted.filter((path) => !current.has(path));

  return { urls: current, loading, missing, reload };
}
