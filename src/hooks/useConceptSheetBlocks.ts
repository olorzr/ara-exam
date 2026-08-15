'use client';

import { useCallback, useState } from 'react';
import { splitHtmlBlocks, splitTableByRows } from '@/lib/print/split-html-blocks';
import type { OversizedHandler } from './useA4Pagination';

/** 표 재분할 반복 상한 — 쪼개도 안 줄어드는 콘텐츠에서 무한 루프를 막는다 */
const MAX_SPLIT_PASSES = 2;

interface BlocksState {
  /** 이 블록들을 만들어 낸 원본 HTML */
  source: string;
  blocks: string[];
  /** 지금까지 표를 다시 쪼갠 횟수 */
  pass: number;
}

interface UseConceptSheetBlocksResult {
  /** 페이지네이션에 넘길 블록 HTML 목록 */
  blocks: string[];
  /** A4Document 의 onOversized 에 그대로 연결한다 */
  handleOversized: OversizedHandler;
}

const initialState = (bodyHTML: string): BlocksState => ({
  source: bodyHTML,
  blocks: splitHtmlBlocks(bodyHTML),
  pass: 0,
});

/**
 * 개념지 본문 HTML 을 블록으로 쪼갠다.
 *
 * 한 페이지에 안 들어가는 표는 실측 행 높이로 다시 조각내어 페이지를 넘겨 이어지게 한다.
 * (표가 아니거나 더 쪼갤 수 없는 블록은 A4Document 가 축소해서 한 장에 담는다.)
 */
export function useConceptSheetBlocks(bodyHTML: string): UseConceptSheetBlocksResult {
  const [state, setState] = useState<BlocksState>(() => initialState(bodyHTML));

  // 본문이 바뀌면 렌더 중에 바로 다시 쪼갠다 (effect + setState 는 한 프레임 늦다)
  if (state.source !== bodyHTML) setState(initialState(bodyHTML));

  const handleOversized = useCallback<OversizedHandler>((indices, measureRoot, capacity) => {
    if (capacity <= 0) return;

    // DOM 읽기는 업데이터 밖에서 끝낸다 (업데이터는 순수해야 한다)
    const blockEls = measureRoot.querySelectorAll<HTMLElement>('[data-measure="block"]');
    const rowHeights = new Map<number, number[]>();
    indices.forEach((index) => {
      const table = blockEls[index]?.querySelector('table');
      if (!table) return;
      rowHeights.set(
        index,
        Array.from(table.querySelectorAll('tr')).map((row) => row.getBoundingClientRect().height),
      );
    });
    if (rowHeights.size === 0) return;

    setState((prev) => {
      if (prev.pass >= MAX_SPLIT_PASSES) return prev;
      let changed = false;
      const blocks: string[] = [];

      prev.blocks.forEach((html, index) => {
        const heights = rowHeights.get(index);
        if (!heights) {
          blocks.push(html);
          return;
        }
        const chunks = splitTableByRows(html, heights, capacity);
        if (chunks.length > 1) changed = true;
        blocks.push(...chunks);
      });

      if (!changed) return prev;
      return { ...prev, blocks, pass: prev.pass + 1 };
    });
  }, []);

  return { blocks: state.blocks, handleOversized };
}
