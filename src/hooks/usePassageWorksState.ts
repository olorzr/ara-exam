'use client';

import { useCallback, useState } from 'react';
import { useTrackedState } from '@/hooks/useTrackedState';
import {
  normalizePassageWorks, normalizeWorkTitles, workTitleKey, worksKey, worksMatchKey,
} from '@/lib/problem-bank/work-title';
import type { Passage, Problem } from '@/types/problem-bank';

/**
 * 지문 카드의 작품 목록 state — 저장 뒤 **DB 가 맞춘 표준 표기**를 받아들인다.
 *
 * 왜 필요한가: DB 트리거(sql/46)는 `엄마걱정` 을 대장 표기 `엄마 걱정` 으로 바꿔 저장한다.
 * 카드가 제가 다듬은 값(`normalizePassageWorks`)으로 칸을 맞추면 저장된 값과 한 칸이 어긋나,
 * 저장했는데도 '저장 안 됨' 배지가 그대로 남는다. 그래서 저장이 끝난 **다음 판**에서 서버
 * 목록이 사람이 보낸 것과 표기만 다를 때(`worksMatchKey` 가 같을 때) 서버 값으로 바꾼다.
 *
 * ⚠️ 받아들이는 것은 저장 직후 한 번뿐이다. 늘 받아들이면 사람이 칸에서 띄어쓰기 하나를
 *    지우는 순간 서버 값으로 튀어 돌아가 입력이 안 되는 것처럼 보인다.
 * ⚠️ 판은 `updated_at` 으로 가른다 — 부모가 새 지문을 먼저 내려주든 저장 함수가 먼저
 *    돌아오든, 보낸 판과 다른 판이 보이는 첫 렌더에서 한 번 맞춘다.
 * @param passage - 지금 화면이 든 지문(부모가 저장 결과로 갈아 끼운다)
 * @returns 작품 목록·설정 함수·최신 ref, 그리고 저장이 끝났음을 알리는 `markSaved`
 */
export function usePassageWorksState(passage: Passage) {
  const [works, setWorks, worksRef] = useTrackedState(passage.works ?? []);
  /** 저장을 보낼 때의 판. 그 판이 지나가면 서버 표기를 받아들인다 */
  const [savedFrom, setSavedFrom] = useState<string | null>(null);

  const serverWorks = passage.works ?? [];
  if (savedFrom !== null && passage.updated_at !== savedFrom) {
    setSavedFrom(null);
    const mine = normalizePassageWorks(works);
    if (worksKey(mine) !== worksKey(serverWorks)
        && worksMatchKey(mine) === worksMatchKey(serverWorks)) {
      setWorks(serverWorks);
    }
  }

  /** 저장에 성공했다 — `version` 은 **보내기 전** 지문의 `updated_at` */
  const markSaved = useCallback((version: string) => setSavedFrom(version), []);

  return { works, setWorks, worksRef, markSaved } as const;
}

/** 제목 목록을 비교 열쇠로 접고 겹친 것은 첫 것만 — DB 의 `canonicalize_work_titles` 와 같은 모양 */
function titlesMatchKey(titles: readonly string[]): string {
  return [...new Set(normalizeWorkTitles(titles).map(workTitleKey))].join('\u0000');
}

/**
 * 문항 카드의 작품명 목록 state — `usePassageWorksState` 의 문항판이다(코덱스 3R).
 *
 * 지문 없는 문항에 `엄마걱정` 을 치고 저장하면 DB 는 `엄마 걱정` 으로 넣는다. 카드가 제 값을
 * 들고 있으면 '저장 안 됨' 이 영영 안 꺼지고 저장할 때마다 옛 표기를 다시 보낸다.
 * @param problem - 지금 화면이 든 문항
 * @returns 작품명 목록·설정 함수, 그리고 저장이 끝났음을 알리는 `markSaved`
 */
export function useProblemWorkTitlesState(problem: Pick<Problem, 'work_titles' | 'updated_at'>) {
  const [workTitles, setWorkTitles] = useState<string[]>(problem.work_titles ?? []);
  const [savedFrom, setSavedFrom] = useState<string | null>(null);

  const serverTitles = problem.work_titles ?? [];
  if (savedFrom !== null && problem.updated_at !== savedFrom) {
    setSavedFrom(null);
    if (workTitles.join('\u0000') !== serverTitles.join('\u0000')
        && titlesMatchKey(workTitles) === titlesMatchKey(serverTitles)) {
      setWorkTitles(serverTitles);
    }
  }

  /** 저장에 성공했다 — `version` 은 **보내기 전** 문항의 `updated_at` */
  const markSaved = useCallback((version: string) => setSavedFrom(version), []);

  return { workTitles, setWorkTitles, markSaved } as const;
}
