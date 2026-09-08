'use client';

import { useCallback, useRef, useState } from 'react';
import {
  autoScrollStep, dropIndexFromPointer, isInside, type ItemRect,
} from '@/lib/problem-paper/dnd';

/**
 * 목록에 끌어 놓기 (포인터 캡처).
 *
 * 라이브러리를 쓰지 않는다 — ara-system 대시보드의 위젯 드래그(`useCardDrag`)와 같은 규칙이면
 * 충분하고, 새 패키지를 늘리지 않는다는 이 저장소의 규칙도 지킨다.
 *
 * 지켜야 할 것(대시보드에서 얻은 교훈):
 *  - `setPointerCapture` 는 try/catch — 이미 놓인 포인터면 잡을 게 없다.
 *  - 미리보기는 **자리가 바뀔 때만** 알린다. 매 move 마다 그리면 목록이 출렁인다.
 *  - up · cancel · lostpointercapture 가 잇따라 와도 커밋은 **한 번**.
 *  - 드래그 중에는 캔버스의 DOM 순서를 바꾸지 않는다. 노드가 옮겨지면 포인터 캡처가 풀려
 *    끌던 동작이 중간에 끊긴다.
 */

export interface ListDragArgs {
  /** 드롭 대상 컨테이너 (스크롤 컨테이너이기도 하다) */
  containerRef: React.RefObject<HTMLElement | null>;
  /** 자리가 바뀔 때마다 — null 이면 컨테이너 밖이라 놓을 수 없다 */
  onPreview: (index: number | null) => void;
  /** 놓았을 때 한 번 */
  onCommit: (index: number | null) => void;
}

export interface ListDragHandlers {
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLElement>) => void;
  onLostPointerCapture: (e: React.PointerEvent<HTMLElement>) => void;
}

interface DragState {
  pointerId: number;
  lastIndex: number | null;
  rects: ItemRect[];
}

/**
 * 드래그 핸들에 붙일 포인터 처리기를 만든다.
 * @param args - 컨테이너와 콜백
 * @returns 끌고 있는지 여부와 핸들러 묶음
 */
export function useListDrag({ containerRef, onPreview, onCommit }: ListDragArgs) {
  const drag = useRef<DragState | null>(null);
  const scrollRaf = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const stopAutoScroll = useCallback(() => {
    if (scrollRaf.current !== null) {
      cancelAnimationFrame(scrollRaf.current);
      scrollRaf.current = null;
    }
  }, []);

  /** 지금 화면의 항목 위치를 잰다 — 드래그 시작 시 한 번 */
  const measure = useCallback((): ItemRect[] => {
    const container = containerRef.current;
    if (!container) return [];
    return Array.from(container.querySelectorAll('[data-drag-item]')).map((el) => {
      const rect = el.getBoundingClientRect();
      return { top: rect.top, height: rect.height };
    });
  }, [containerRef]);

  const indexAt = useCallback((state: DragState, x: number, y: number): number | null => {
    const container = containerRef.current;
    if (!container) return null;
    const box = container.getBoundingClientRect();
    if (!isInside(box, x, y)) return null;
    return dropIndexFromPointer(state.rects, y);
  }, [containerRef]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    // 주 버튼·첫 손가락만
    if (e.button !== 0 || !e.isPrimary) return;
    e.stopPropagation();
    // 호환 mousedown 을 막아 글자 선택이 생기지 않게 하고, 포커스는 직접 준다
    e.preventDefault();
    e.currentTarget.focus();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      return; // 이미 놓인 포인터 — 잡을 게 없다
    }
    drag.current = { pointerId: e.pointerId, lastIndex: null, rects: measure() };
    setDragging(true);
  }, [measure]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const state = drag.current;
    if (!state || e.pointerId !== state.pointerId) return;
    e.stopPropagation();

    const next = indexAt(state, e.clientX, e.clientY);
    if (next !== state.lastIndex) {
      state.lastIndex = next;
      onPreview(next);
    }

    // 가장자리에 닿으면 컨테이너를 굴린다 — 긴 목록에서 끝까지 끌 수 있어야 한다
    const container = containerRef.current;
    if (container) {
      const box = container.getBoundingClientRect();
      const step = autoScrollStep(box, e.clientY);
      stopAutoScroll();
      if (step !== 0) {
        const roll = () => {
          container.scrollTop += step;
          scrollRaf.current = requestAnimationFrame(roll);
        };
        scrollRaf.current = requestAnimationFrame(roll);
      }
    }
  }, [containerRef, indexAt, onPreview, stopAutoScroll]);

  const finish = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const state = drag.current;
    if (!state || e.pointerId !== state.pointerId) return;
    e.stopPropagation();
    // 먼저 비워 둔다 — up·cancel·lostpointercapture 가 잇따라 와도 커밋은 한 번
    drag.current = null;
    stopAutoScroll();
    setDragging(false);
    onCommit(state.lastIndex);
    onPreview(null);
  }, [onCommit, onPreview, stopAutoScroll]);

  return {
    dragging,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish,
      onLostPointerCapture: finish,
    } satisfies ListDragHandlers,
  };
}
