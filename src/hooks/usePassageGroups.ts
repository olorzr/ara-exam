'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  fetchPassageHeadsByIds, fetchPassagesByIds, type PassageHead,
} from '@/lib/problem-bank/detail-queries';
import {
  groupByPassageInPlace, groupRowsByPassage, type PassageGroup,
} from '@/lib/problem-bank/passage-groups';
import type { Passage } from '@/types/problem-bank';

/**
 * 묶는 방식.
 *
 * · `work` — 작품으로 훑는 중. 같은 지문을 하나로 모으고 **본문까지** 읽어 온다
 *   (그 화면에서 '어느 대목인가' 를 펼쳐 봐야 한다).
 * · `list` — 그 밖의 조건. 같은 지문을 똑같이 모으되 지문 없는 문항을 제자리에 두고,
 *   지문은 **머리만** 읽어 온다.
 */
export type PassageGroupMode = 'work' | 'list';

/** 지문을 붙인 묶음 */
export interface LoadedPassageGroup<T> extends PassageGroup<T> {
  /**
   * 지문. 지문이 없는 묶음이거나 **아직·끝내 못 읽은** 경우 null 이다 —
   * 둘을 가르려면 `passageId` 를 함께 봐야 한다(`passageId` 가 있는데 null 이면 못 읽은 것).
   * `list` 모드에서는 본문이 없는 **머리**(`PassageHead`)다.
   */
  passage: Passage | PassageHead | null;
}

/**
 * 목록을 지문별로 묶고, 그 지문들을 함께 읽어 온다.
 *
 * 목록 조회는 지문을 가져오지 않는다(`PROBLEM_LIST_COLUMNS` 에 없다 — 본문 HTML 이
 * 무겁다). 한 쪽 분량(최대 60개)의 지문을 따로 읽되, **작품으로 볼 때만 본문까지** 읽고
 * 그 밖에는 머리(제목·작품·머리글)만 읽는다.
 * @param rows - 목록 행
 * @param mode - 묶는 방식
 * @param enabled - 목록을 다 불러왔을 때만 켠다
 * @returns 묶음과 로딩 상태
 */
export function usePassageGroups<T extends { passage_id: string | null }>(
  rows: readonly T[],
  mode: PassageGroupMode,
  enabled: boolean,
): { groups: LoadedPassageGroup<T>[]; loading: boolean } {
  /**
   * 받아 둔 지문과 **그것이 어느 조회의 것인지**.
   *
   * ⚠️ 지문 지도와 키를 따로 두지 말 것(코덱스 7R). 따로 두면 조건·모드가 바뀐 **다음** 조회가
   *    실패했을 때 **앞 조회의 값이 그대로 남아** 화면이 거짓을 말한다 — 목록에서 머리만
   *    받아 둔 지문을 작품 화면이 물려받으면 본문 조회가 실패해도 '못 읽었어요' 가 안 뜨고
   *    '본문 보기' 도 없는, 아무 일 없는 것처럼 보이는 상자가 남는다.
   */
  const [loaded, setLoaded] = useState<{
    key: string;
    map: Map<string, Passage | PassageHead>;
  }>({ key: '', map: new Map() });

  // 배열은 렌더마다 새 참조라 그대로 의존성에 넣으면 무한 루프가 된다.
  // ⚠️ 키에 **모드도 접어 넣는다** — 머리만 받아 둔 목록을 작품 화면이 물려받으면
  //    본문이 없어 '본문 보기' 가 통째로 사라진다(그 반대는 무해하지만 규약을 하나로 둔다).
  // ⚠️ 지문이 딸린 문항이 하나도 없으면 키도 빈다 — 조회할 것이 없는데 키만 남기면
  //    로딩이 영영 안 끝나거나, 끝내려고 효과 안에서 동기 setState 를 하게 된다(lint 가 막는다)
  const ids = [...new Set(rows.map((r) => r.passage_id).filter(Boolean) as string[])].sort();
  const key = enabled && ids.length > 0 ? `${mode}:${ids.join('|')}` : '';

  useEffect(() => {
    if (!key) return;
    const scope = key.slice(0, key.indexOf(':'));
    const wanted = key.slice(key.indexOf(':') + 1).split('|');
    let alive = true;
    // setState 는 `.then` 안에서만 한다(효과 안 동기 setState 금지)
    (scope === 'work' ? fetchPassagesByIds(wanted) : fetchPassageHeadsByIds(wanted))
      .then((rowsIn) => {
        if (alive) setLoaded({ key, map: new Map(rowsIn.map((p) => [p.id, p])) });
      })
      .catch(() => {
        // 지문을 못 읽어도 목록은 보여야 한다. 다만 **'지문 없음' 으로 보이면 안 된다** —
        // 그건 거짓말이다(코덱스 리뷰 4R). 화면이 passageId 로 둘을 가른다.
        // 빈 지도를 이 키의 결과로 남겨 **앞 조회의 값이 새 조회 자리에 서지 않게** 한다
        if (alive) setLoaded({ key, map: new Map() });
      });
    return () => { alive = false; };
  }, [key]);

  const groups = useMemo(() => {
    if (!enabled) return [];
    const grouped = mode === 'work' ? groupRowsByPassage(rows) : groupByPassageInPlace(rows);
    // ⚠️ 지금 키의 결과일 때만 쓴다 — 아직 오지 않은 조회 자리에 앞의 값을 세우면
    //    옛 쪽의 지문이 새 쪽 머리에 잠깐 찍힌다
    const map = loaded.key === key ? loaded.map : null;
    return grouped.map((group) => ({
      ...group,
      passage: group.passageId ? map?.get(group.passageId) ?? null : null,
    }));
  }, [enabled, mode, rows, key, loaded]);

  // 로딩을 state 로 두고 효과에서 켜면 렌더가 한 번 더 돈다.
  // '무엇을 이미 받아 왔는가'만 기억하고 로딩은 파생한다(useSignedImageUrls 와 같은 규약)
  const loading = key !== '' && loaded.key !== key;

  return { groups, loading };
}
