'use client';

import { useCallback, useState } from 'react';
import { useTrackedState } from '@/hooks/useTrackedState';
import { worksKey } from '@/lib/problem-bank/work-title';
import type { Passage, PassageWork, Problem } from '@/types/problem-bank';

/** 저장 한 번의 기록 — 보내기 전 판과 보낸 값 */
interface SavedFrom<T> {
  version: string;
  sent: T;
}

/**
 * 지문 카드의 작품 목록 state — 저장 뒤 **DB 가 맞춘 표기**를 받아들인다.
 *
 * 왜 필요한가: DB 트리거(sql/46·47)는 저장값을 대장 표기로 바꾼다 — 띄어쓰기(`엄마걱정` →
 * `엄마 걱정`)뿐 아니라 **동의어**(`아끼다가 똥 될지라도` → `아끼다 똥 될지라도`)까지. 카드가
 * 제가 보낸 값을 들고 있으면 저장된 값과 영영 달라 '저장 안 됨' 배지가 남는다.
 *
 * 규칙은 **"저장한 뒤 사람이 더 고치지 않았으면 서버 값이 곧 저장된 값이다"** 하나다. 표기만
 * 다를 때로 좁히면(코덱스 2R 까지의 판) 동의어처럼 열쇠까지 다른 교체를 못 받는다.
 *
 * ⚠️ 받아들이는 것은 저장 직후 한 번뿐이다. 늘 받아들이면 칸에서 띄어쓰기 하나를 지우는
 *    순간 서버 값으로 튀어 돌아가 입력이 안 되는 것처럼 보인다.
 * ⚠️ 판은 `updated_at` 으로 가른다 — 부모가 새 지문을 먼저 내려주든 저장 함수가 먼저
 *    돌아오든, 보낸 판과 다른 판이 보이는 첫 렌더에서 한 번 맞춘다.
 * @param passage - 지금 화면이 든 지문(부모가 저장 결과로 갈아 끼운다)
 * @returns 작품 목록·설정 함수·최신 ref, 그리고 저장이 끝났음을 알리는 `markSaved`
 */
export function usePassageWorksState(passage: Passage) {
  const [works, setWorks, worksRef] = useTrackedState(passage.works ?? []);
  const [savedFrom, setSavedFrom] = useState<SavedFrom<PassageWork[]> | null>(null);

  const serverWorks = passage.works ?? [];
  if (savedFrom !== null && passage.updated_at !== savedFrom.version) {
    setSavedFrom(null);
    const mine = worksKey(works);
    if (mine === worksKey(savedFrom.sent) && mine !== worksKey(serverWorks)) {
      setWorks(serverWorks);
    }
  }

  /**
   * 저장에 성공했다.
   * @param version - **보내기 전** 지문의 `updated_at`
   * @param sent - 칸에 맞춰 둔 보낸 값(다듬은 목록)
   */
  const markSaved = useCallback(
    (version: string, sent: PassageWork[]) => setSavedFrom({ version, sent }),
    [],
  );

  return { works, setWorks, worksRef, markSaved } as const;
}

/**
 * 문항 카드의 작품명 목록 state — `usePassageWorksState` 의 문항판이다(코덱스 3R).
 *
 * 지문 없는 문항은 작품명을 직접 친다 — 그 값도 DB 가 대장 표기로 바꿔 넣는다.
 * @param problem - 지금 화면이 든 문항
 * @returns 작품명 목록·설정 함수, 그리고 저장이 끝났음을 알리는 `markSaved`
 */
export function useProblemWorkTitlesState(problem: Pick<Problem, 'work_titles' | 'updated_at'>) {
  const [workTitles, setWorkTitles] = useState<string[]>(problem.work_titles ?? []);
  const [savedFrom, setSavedFrom] = useState<SavedFrom<string[]> | null>(null);

  const serverTitles = problem.work_titles ?? [];
  if (savedFrom !== null && problem.updated_at !== savedFrom.version) {
    setSavedFrom(null);
    const mine = workTitles.join('\u0000');
    if (mine === savedFrom.sent.join('\u0000') && mine !== serverTitles.join('\u0000')) {
      setWorkTitles(serverTitles);
    }
  }

  /**
   * 저장에 성공했다.
   * @param version - **보내기 전** 문항의 `updated_at`
   * @param sent - 보낸 작품명 목록
   */
  const markSaved = useCallback(
    (version: string, sent: string[]) => setSavedFrom({ version, sent }),
    [],
  );

  return { workTitles, setWorkTitles, markSaved } as const;
}
