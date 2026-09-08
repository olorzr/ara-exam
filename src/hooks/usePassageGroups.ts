'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchPassagesByIds } from '@/lib/problem-bank/detail-queries';
import { groupRowsByPassage, type PassageGroup } from '@/lib/problem-bank/passage-groups';
import type { Passage } from '@/types/problem-bank';

/** 지문 본문까지 붙인 묶음 */
export interface LoadedPassageGroup<T> extends PassageGroup<T> {
  /**
   * 지문 본문. 지문이 없는 묶음이거나 **아직·끝내 못 읽은** 경우 null 이다 —
   * 둘을 가르려면 `passageId` 를 함께 봐야 한다(`passageId` 가 있는데 null 이면 못 읽은 것).
   */
  passage: Passage | null;
}

/**
 * 목록을 지문별로 묶고, 그 지문들의 본문을 함께 읽어 온다.
 *
 * 목록 조회는 지문 본문을 안 가져온다(`PROBLEM_LIST_COLUMNS` 에 없다 — 본문 HTML 이
 * 무겁다). 작품으로 볼 때만 한 쪽 분량(최대 60개)의 지문을 따로 읽는다.
 * @param rows - 목록 행
 * @param enabled - 작품 조건이 걸렸을 때만 켠다
 * @returns 묶음과 로딩 상태
 */
export function usePassageGroups<T extends { passage_id: string | null }>(
  rows: readonly T[],
  enabled: boolean,
): { groups: LoadedPassageGroup<T>[]; loading: boolean } {
  const [passages, setPassages] = useState<Map<string, Passage>>(new Map());
  const [loadedKey, setLoadedKey] = useState('');

  // 배열은 렌더마다 새 참조라 그대로 의존성에 넣으면 무한 루프가 된다
  const key = enabled
    ? [...new Set(rows.map((r) => r.passage_id).filter(Boolean) as string[])].sort().join('|')
    : '';

  useEffect(() => {
    if (!key) return;
    let alive = true;
    // setState 는 `.then` 안에서만 한다(효과 안 동기 setState 금지)
    fetchPassagesByIds(key.split('|'))
      .then((rowsIn) => {
        if (alive) setPassages(new Map(rowsIn.map((p) => [p.id, p])));
      })
      .catch(() => {
        // 본문을 못 읽어도 목록은 보여야 한다. 다만 **'지문 없음' 으로 보이면 안 된다** —
        // 그건 거짓말이다(코덱스 리뷰 4R). 화면이 passageId 로 둘을 가른다
      })
      .finally(() => {
        if (alive) setLoadedKey(key);
      });
    return () => { alive = false; };
  }, [key]);

  const groups = useMemo(() => {
    if (!enabled) return [];
    return groupRowsByPassage(rows).map((group) => ({
      ...group,
      passage: group.passageId ? passages.get(group.passageId) ?? null : null,
    }));
  }, [enabled, rows, passages]);

  // 로딩을 state 로 두고 효과에서 켜면 렌더가 한 번 더 돈다.
  // '무엇을 이미 받아 왔는가'만 기억하고 로딩은 파생한다(useSignedImageUrls 와 같은 규약)
  const loading = key !== '' && loadedKey !== key;

  return { groups, loading };
}
