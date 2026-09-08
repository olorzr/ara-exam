'use client';

import { useCallback, useMemo, useState } from 'react';
import { toggleAllVisible, toggleId, visibleSelection } from '@/lib/problem-bank/selection';

/** 선택할 수 있는 최소한의 행 */
interface SelectableRow {
  id: string;
}

/**
 * 아카이브 목록의 선택 모드.
 *
 * ⚠️ **효과로 선택을 되돌리지 않는다**(`react-hooks/set-state-in-effect` 는 이 저장소에서
 *    에러다). 대신 "지금 보이는 행과의 교집합"을 렌더 단계에서 파생해, 쪽을 넘겨
 *    옛 id 가 남아 있어도 삭제 대상에는 절대 들어가지 않게 한다.
 *    화면에서 조건을 바꿀 때 선택을 비우는 것은 호출부(`clear`)의 몫이다.
 * @param rows - 지금 화면에 그려진 행
 * @returns 선택 상태와 조작 함수
 */
export function useArchiveSelection(rows: readonly SelectableRow[]) {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const visibleIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const selectedVisible = useMemo(
    () => visibleSelection(selectedIds, visibleIds),
    [selectedIds, visibleIds],
  );
  const isAllSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => toggleId(prev, id));
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => toggleAllVisible(prev, visibleIds));
  }, [visibleIds]);

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  const enter = useCallback(() => setSelectMode(true), []);

  const exit = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  return {
    selectMode,
    /** 지금 보이는 행 중 선택된 id — 삭제는 **반드시** 이것만 대상으로 한다 */
    selectedVisible,
    count: selectedVisible.length,
    isAllSelected,
    isSelected,
    toggle,
    toggleAll,
    clear,
    enter,
    exit,
  };
}
