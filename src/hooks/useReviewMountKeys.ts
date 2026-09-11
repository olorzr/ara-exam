'use client';

import { useCallback, useState } from 'react';

/**
 * 검수 카드를 **언제 다시 마운트할지** 를 관리한다.
 *
 * ⚠️ 편집 카드는 폼 값을 **지역 state** 로 들고 있다. 서버 본문을 새로 받아 놓고 카드를
 *    그대로 두면, 화면에는 옛 입력이 남은 채 새 버전 토큰만 붙는다 — 그 상태로 저장하면
 *    **남의 수정을 조용히 덮어쓴다**(코덱스 리뷰 4R). 그래서 본문을 다시 읽으면 카드도
 *    반드시 다시 마운트해야 한다.
 *
 * 세대가 둘인 이유: 지문 작품명을 바꾸면 **그 지문에 딸린 문항만** 서버에서 값이 바뀐다.
 * 전체 세대만 있으면 상관없는 문항에서 고치던 내용까지 함께 사라지므로, 바뀐 문항만
 * 골라 올려 **피해를 그 문항들로 좁힌다**.
 */
export function useReviewMountKeys() {
  /** 서버에서 본문을 통째로 다시 읽어 온 횟수 */
  const [reloadSeq, setReloadSeq] = useState(0);
  /** 문항별 다시 마운트 세대 */
  const [itemSeq, setItemSeq] = useState<Map<string, number>>(new Map());

  /** 화면의 카드를 전부 다시 마운트한다 */
  const bumpAll = useCallback(() => setReloadSeq((n) => n + 1), []);

  /**
   * 고른 항목만 다시 마운트한다.
   * @param ids - 서버 값이 바뀐 항목들
   */
  const bumpItems = useCallback((ids: readonly string[]) => {
    if (ids.length === 0) return;
    setItemSeq((prev) => {
      const next = new Map(prev);
      for (const id of ids) next.set(id, (next.get(id) ?? 0) + 1);
      return next;
    });
  }, []);

  /**
   * 이 카드를 몇 번째로 마운트하는가 — 호출부가 `key` 에 섞는다.
   * @param id - 문항·지문 id
   * @returns 세대 문자열
   */
  const mountKey = useCallback(
    (id: string) => `${reloadSeq}:${itemSeq.get(id) ?? 0}`,
    [reloadSeq, itemSeq],
  );

  return { reloadSeq, mountKey, bumpAll, bumpItems };
}
