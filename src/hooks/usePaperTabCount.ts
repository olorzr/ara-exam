'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import type { OwnerScope } from '@/lib/owner-scope';
import { PAPER_SEARCH_LIMIT, searchPapers } from '@/lib/problem-paper/paper-search';

/** 읽어 둔 개수 — 어느 탭·어느 찾는 말의 것인지와 함께 든다 */
interface LoadedCount {
  key: string;
  count: number | null;
}

/**
 * 찾는 동안 **다른 탭**에서 몇 개가 찾아지는가 — 탭 이름 옆 숫자와 '다른 선생님이 만든 것에서 N개 보기' 단추가 쓴다.
 *
 * 찾는 말이 비면 묻지 않는다(탭 이름은 숫자 없이 그대로). 실패하면 숫자를 안 보인다(곁가지라 알림을 띄우지 않는다).
 * 늦게 온 옛 응답은 버린다 — usePaperList 와 같은 '어느 열쇠의 값인가' 파생이다.
 * @param scope - 개수를 셀 탭
 * @param keyword - 찾는 말(다듬어 디바운스한 값)
 * @returns 개수(모르면 null)와 상한에 닿았는가
 */
export function usePaperTabCount(scope: OwnerScope, keyword: string): { count: number | null; capped: boolean } {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const key = `${scope}:${userId}:${keyword}`;
  const [loaded, setLoaded] = useState<LoadedCount | null>(null);

  useEffect(() => {
    if (!userId || !keyword) return;
    let alive = true;
    searchPapers(scope, userId, keyword)
      .then((papers) => { if (alive) setLoaded({ key, count: papers.length }); })
      .catch(() => { if (alive) setLoaded({ key, count: null }); });
    return () => { alive = false; };
  }, [key, scope, userId, keyword]);

  const count = keyword && loaded?.key === key ? loaded.count : null;
  return { count, capped: count !== null && count >= PAPER_SEARCH_LIMIT };
}
