'use client';

import { useCallback, useState } from 'react';
import { splitHtmlBlocks, splitTableByRows } from '@/lib/print/split-html-blocks';
import { measureColumnWidths, measureRowHeights } from '@/lib/print/table-measure';
import type { OversizedHandler } from './useA4Pagination';

/**
 * 표 재분할 반복 상한.
 * 진짜 종료 조건은 아래 `changed` 다 — `splitTableByRows` 는 쪼갤 수 없으면 입력을 그대로 돌려주고
 * 그때는 상태를 갱신하지 않는다. 이 상수는 그 위의 안전망이다(측정 오차로 조각이 다시 넘치는 2패스까지).
 */
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

/** 넘친 표 블록 하나의 실측값 */
interface TableMeasure {
  rowHeights: number[];
  /** 행 높이 합 말고도 표가 먹는 높이(표 상하 마진·테두리)를 뺀 실제 행 예산 */
  rowBudget: number;
  /** 조각의 열 폭을 고정할 기준 행의 셀 폭. 기준 행이 없으면 null */
  colWidths: number[] | null;
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
    const measures = new Map<number, TableMeasure>();

    indices.forEach((index) => {
      const blockEl = blockEls[index];
      const table = blockEl?.querySelector('table');
      if (!blockEl || !table) return;
      const rowHeights = measureRowHeights(table);
      const rowsTotal = rowHeights.reduce((total, height) => total + height, 0);
      // 블록 높이 - 행 높이 합 = 표 바깥 여백. 이걸 안 빼면 쪼갠 조각이 또 넘친다
      const chrome = Math.max(0, blockEl.getBoundingClientRect().height - rowsTotal);
      measures.set(index, {
        rowHeights,
        rowBudget: capacity - chrome,
        colWidths: measureColumnWidths(table),
      });
    });
    if (measures.size === 0) return;

    setState((prev) => {
      if (prev.pass >= MAX_SPLIT_PASSES) return prev;
      let changed = false;
      const blocks: string[] = [];

      prev.blocks.forEach((html, index) => {
        const measure = measures.get(index);
        if (!measure || measure.rowBudget <= 0) {
          blocks.push(html);
          return;
        }
        const chunks = splitTableByRows(
          html,
          measure.rowHeights,
          measure.rowBudget,
          measure.colWidths ?? undefined,
        );
        if (chunks.length > 1) changed = true;
        blocks.push(...chunks);
      });

      if (!changed) return prev;
      return { ...prev, blocks, pass: prev.pass + 1 };
    });
  }, []);

  return { blocks: state.blocks, handleOversized };
}
