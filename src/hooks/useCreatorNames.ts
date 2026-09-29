'use client';

import { useEffect, useState } from 'react';
import { fetchCreatorNames } from '@/lib/creator-names';

/** 아직 못 읽었을 때 — 렌더마다 새 지도를 만들지 않도록 하나를 돌려 쓴다 */
const EMPTY: ReadonlyMap<string, string> = new Map();

/**
 * 만든 선생님 이름 지도 — 다른 선생님 탭에서 줄마다 누가 만들었는지 보인다.
 *
 * 받아 둔 지도를 **어느 id 묶음의 것인지와 함께** 든다 — 탭을 바꾼 뒤 옛 지도로 그리면
 * 이름이 비는 것까지는 괜찮지만, 효과에서 동기로 비우면 lint(`set-state-in-effect`)가 막는다.
 * @param ids - 만든 사람 id 들 (비우면 묻지 않는다)
 * @returns id → 이름 (못 읽었으면 빈 지도)
 */
export function useCreatorNames(ids: readonly string[]): ReadonlyMap<string, string> {
  const key = [...new Set(ids.filter(Boolean))].sort().join(',');
  const [loaded, setLoaded] = useState<{ key: string; names: Map<string, string> } | null>(null);

  useEffect(() => {
    if (!key) return;
    let alive = true;
    fetchCreatorNames(key.split(',')).then((names) => {
      if (alive) setLoaded({ key, names });
    });
    return () => { alive = false; };
  }, [key]);

  return loaded?.key === key ? loaded.names : EMPTY;
}
