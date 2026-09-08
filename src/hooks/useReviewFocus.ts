'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { OcrWarningTarget } from '@/lib/problem-ocr/warnings';

/** 화면이 짚어 줄 수 있는 항목 — 지문·문항 모두 이 모양이면 된다 */
interface FocusableItem {
  id: string;
  page_no: number;
}

interface UseReviewFocusInput {
  /** 화면에 있는 쪽 목록 (오름차순) */
  pages: number[];
  /** 짚을 수 있는 항목들 */
  items: FocusableItem[];
  /** 아직 불러오는 중인가 — 카드가 DOM 에 있어야 스크롤할 수 있다 */
  loading: boolean;
  /** 주소로 넘어온 항목 id (`?item=`). 없으면 null */
  wantedItem: string | null;
}

/**
 * 검수 화면의 **어디를 보고 있는가** — 쪽 선택과 항목 강조.
 *
 * 이 로직이 세 곳에서 함께 쓰인다: 원본 이미지의 상자, 오른쪽 카드, 그리고
 * 경고 배너의 대상 칩. 셋이 서로 다른 방식으로 움직이면 "경고를 눌렀는데 다른 쪽이
 * 보이는" 일이 생기므로 한곳에 모은다.
 * @param input - 쪽·항목·로딩 상태와 주소로 넘어온 항목
 * @returns 보고 있는 쪽과 고른 항목, 그리고 옮겨 가는 함수들
 */
export function useReviewFocus({ pages, items, loading, wantedItem }: UseReviewFocusInput) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [wantedPage, setPage] = useState(1);

  // 보고 있던 쪽이 목록에서 사라지면(항목을 다 지웠을 때) 첫 쪽으로 떨어뜨린다.
  // state 를 효과로 되돌리지 않고 **파생**한다 — 렌더가 한 번 더 도는 것을 막는다.
  const page = pages.includes(wantedPage) ? wantedPage : pages[0] ?? 1;

  /** 그 항목이 있는 쪽으로 넘기고 카드를 강조·스크롤한다 */
  const focusItem = useCallback((id: string, itemPage?: number) => {
    if (itemPage) setPage(itemPage);
    setSelectedId(id);
    document
      .querySelector(`[data-problem-id="${id}"], [data-passage-id="${id}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  /**
   * 카드를 눌렀을 때.
   * 이미 고른 항목을 다시 누르면(편집 중 포커스) **쪽은 그대로 둔다** — 여러 쪽에 걸친
   * 지문을 이어지는 쪽과 대조하며 고칠 수 있어야 한다.
   */
  const selectCard = useCallback((id: string, itemPage: number) => {
    setSelectedId((prev) => {
      if (prev !== id) setPage(itemPage);
      return id;
    });
  }, []);

  /** 경고 칩을 눌렀을 때 — 항목이면 그 카드로, 쪽뿐이면 그 쪽으로 */
  const goToTarget = useCallback((target: OcrWarningTarget) => {
    if (target.id) focusItem(target.id, target.page);
    else if (target.page) setPage(target.page);
  }, [focusItem]);

  /**
   * 주소로 넘어온 항목(`?item=`)을 한 번만 짚어 준다 — 업로드 화면의 경고 칩이 보낸다.
   *
   * ⚠️ 효과 본문에서 곧바로 setState 를 하면 lint(`set-state-in-effect`)가 막는다.
   *    마이크로태스크로 미루면 규칙에도 맞고, 카드가 이미 그려진 뒤라 스크롤도 맞는다.
   */
  const doneRef = useRef(false);
  useEffect(() => {
    if (doneRef.current || loading || !wantedItem) return;
    const target = items.find((item) => item.id === wantedItem);
    if (!target) return;
    doneRef.current = true;
    queueMicrotask(() => focusItem(target.id, target.page_no));
  }, [loading, wantedItem, items, focusItem]);

  return { page, selectedId, setPage, focusItem, selectCard, goToTarget };
}
