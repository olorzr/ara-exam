'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { splitHtmlBlocks, splitTableByRows } from '@/lib/print/split-html-blocks';
import { applyColumnWidths, fitColumnWidths } from '@/lib/print/table-col-fit';
import { tableRowCount } from '@/lib/print/table-dom';
import {
  measureColumnWidths,
  measureMaxContentWidths,
  measureRowHeights,
} from '@/lib/print/table-measure';
import type { BeforePaginateHandler, SplitRequestHandler } from './useA4Pagination';

/**
 * 시트 본문 래퍼 클래스.
 * 표 CSS 가 이 클래스 아래에만 걸려 있어 폭을 재는 프로브도 같은 클래스를 써야 한다.
 */
export const SHEET_BODY_CLASS = 'sheet-body';

/**
 * 표 재분할 반복 상한(안전망).
 * 한 패스에 표 하나만 쪼개므로 표가 여러 개면 그만큼 패스가 돈다. 진짜 종료 조건은
 * "받아들인 분할은 블록 수를 늘리고, 본문 한 행짜리 조각은 더 못 쪼갠다" 이다.
 */
const MAX_SPLIT_PASSES = 32;

interface BlocksState {
  /** 이 블록들을 만들어 낸 원본 HTML */
  source: string;
  blocks: string[];
  /** 지금까지 표를 다시 쪼갠 횟수 */
  pass: number;
}

/** 열 폭을 맞춘 시점 — 폰트가 늦게 오면 글자 폭이 달라져 한 번 더 맞춰야 한다 */
interface FitMark {
  source: string;
  /** 웹폰트가 다 적용된 뒤에 맞췄는가 */
  fontsReady: boolean;
}

interface UseConceptSheetBlocksResult {
  /** 페이지네이션에 넘길 블록 HTML 목록 */
  blocks: string[];
  /** 블록별 분할 가능 여부 — A4Document 의 splittable 에 그대로 연결한다 */
  splittable: boolean[];
  /** A4Document 의 onBeforePaginate 에 그대로 연결한다 */
  handleBeforePaginate: BeforePaginateHandler;
  /** A4Document 의 onSplitRequest 에 그대로 연결한다 */
  handleSplitRequest: SplitRequestHandler;
}

/** 분할 요청 하나의 실측값 */
interface TableMeasure {
  index: number;
  rowHeights: number[];
  /** 뒤 조각들이 쓸 수 있는 행 높이 예산 (표 상하 마진·테두리를 뺀 값) */
  capacity: number;
  /** 앞 조각이 쓸 수 있는 행 높이 예산 — 지금 페이지에 남은 자리 */
  firstCapacity: number;
  /** 조각의 열 폭을 고정할 기준 행의 셀 폭. 기준 행이 없으면 null */
  colWidths: number[] | null;
}

const initialState = (bodyHTML: string): BlocksState => ({
  source: bodyHTML,
  blocks: splitHtmlBlocks(bodyHTML),
  pass: 0,
});

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

/** 웹폰트 로딩이 끝났는가 (지원하지 않는 환경이면 끝난 것으로 본다) */
function areFontsReady(): boolean {
  return typeof document === 'undefined' || document.fonts?.status !== 'loading';
}

/**
 * 표 블록의 열 폭을 컬럼 폭에 맞춰 박는다.
 * 표가 아니거나 폭을 못 재면(측정 컨테이너가 아직 레이아웃 전, jsdom 등) 입력을 그대로 둔다.
 */
function fitTableBlock(html: string, root: HTMLElement, columnWidth: number): string {
  const maxWidths = measureMaxContentWidths(html, root, SHEET_BODY_CLASS);
  if (!maxWidths) return html;
  const widths = fitColumnWidths(maxWidths, columnWidth);
  return widths ? applyColumnWidths(html, widths) : html;
}

/**
 * 개념지 본문 HTML 을 블록으로 쪼갠다.
 *
 * 표는 두 단계로 손본다 — (1) 배치 전에 열 폭을 실측해 맞추고(짧은 열이 한 글자로 눌려
 * 행이 늘어나는 것을 막는다), (2) 페이지에 남은 자리에 안 들어가면 행 단위로 쪼개
 * 남은 자리를 채우고 다음 장으로 이어지게 한다.
 * (표가 아니거나 더 쪼갤 수 없는 블록은 A4Document 가 축소해서 한 장에 담는다.)
 */
export function useConceptSheetBlocks(bodyHTML: string): UseConceptSheetBlocksResult {
  const [state, setState] = useState<BlocksState>(() => initialState(bodyHTML));
  const fitRef = useRef<FitMark | null>(null);

  // 본문이 바뀌면 렌더 중에 바로 다시 쪼갠다 (effect + setState 는 한 프레임 늦다)
  if (state.source !== bodyHTML) setState(initialState(bodyHTML));

  const handleBeforePaginate = useCallback<BeforePaginateHandler>(
    (root, columnWidth) => {
      const fontsReady = areFontsReady();
      const mark = fitRef.current;
      // 같은 본문을 이미 맞췄으면 다시 안 한다. 폴백 폰트로 맞춘 경우만 폰트가 온 뒤 한 번 더
      if (mark?.source === bodyHTML && (mark.fontsReady || !fontsReady)) return false;

      // 분할 전 원본 블록에서 다시 시작한다 — 폭이 바뀌면 행 높이가 달라져 옛 조각은 못 쓴다
      const original = splitHtmlBlocks(bodyHTML);
      const fitted = original.map((html) => fitTableBlock(html, root, columnWidth));
      fitRef.current = { source: bodyHTML, fontsReady };
      if (fitted.every((html, index) => html === original[index])) return false;

      setState({ source: bodyHTML, blocks: fitted, pass: 0 });
      return true;
    },
    [bodyHTML],
  );

  const handleSplitRequest = useCallback<SplitRequestHandler>((requests, measureRoot) => {
    // DOM 읽기는 업데이터 밖에서 끝낸다 (업데이터는 순수해야 한다)
    const blockEls = measureRoot.querySelectorAll<HTMLElement>('[data-measure="block"]');
    const measures: TableMeasure[] = [];

    requests.forEach(({ index, firstCapacity, laterCapacity }) => {
      const blockEl = blockEls[index];
      const table = blockEl?.querySelector('table');
      if (!blockEl || !table) return;
      const rowHeights = measureRowHeights(table);
      // 블록 높이 - 행 높이 합 = 표 바깥 여백. 이걸 안 빼면 쪼갠 조각이 또 넘친다
      const chrome = Math.max(0, blockEl.getBoundingClientRect().height - sum(rowHeights));
      measures.push({
        index,
        rowHeights,
        capacity: laterCapacity - chrome,
        firstCapacity: firstCapacity - chrome,
        colWidths: measureColumnWidths(table),
      });
    });
    if (measures.length === 0) return;

    setState((prev) => {
      if (prev.pass >= MAX_SPLIT_PASSES) return prev;

      // 문서 순서상 첫 요청부터 시도하되 **실제로 쪼개진 하나만** 반영한다.
      // 앞 표를 쪼개면 뒤 표의 남은 자리가 달라져 뒤 요청의 용량은 이미 낡은 값이다
      for (const measure of measures) {
        const html = prev.blocks[measure.index];
        // 측정과 상태가 어긋났으면(중간에 다른 갱신) 이 요청은 버린다
        if (html === undefined || tableRowCount(html) !== measure.rowHeights.length) continue;
        if (measure.capacity <= 0) continue;

        const chunks = splitTableByRows(html, measure.rowHeights, {
          capacity: measure.capacity,
          firstCapacity: measure.firstCapacity,
          colWidths: measure.colWidths ?? undefined,
        });
        if (chunks.length <= 1) continue;

        const blocks = [
          ...prev.blocks.slice(0, measure.index),
          ...chunks,
          ...prev.blocks.slice(measure.index + 1),
        ];
        return { ...prev, blocks, pass: prev.pass + 1 };
      }
      return prev;
    });
  }, []);

  const splittable = useMemo(() => state.blocks.map((html) => tableRowCount(html) > 1), [state.blocks]);

  return { blocks: state.blocks, splittable, handleBeforePaginate, handleSplitRequest };
}
