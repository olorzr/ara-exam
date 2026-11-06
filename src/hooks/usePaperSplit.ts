'use client';

import { useCallback, useMemo, useState } from 'react';
import { areFontsReady } from '@/lib/print/fonts-ready';
import type { BreakBefore } from '@/lib/print/paginate';
import type { PaperBlock } from '@/lib/problem-paper/blocks';
import type { PartMeasure } from '@/lib/problem-paper/part-measure';
import { planSplitRound } from '@/lib/problem-paper/part-split-plan';
import { splitTargetOf } from '@/lib/problem-paper/split-target';
import type { SplitRequestHandler } from './useA4Pagination';

/**
 * 측정 패스 상한(안전망) — 한 패스에 그 라운드의 자르기를 전부 하므로 보통 두세 번이면 끝난다.
 * ⚠️ 50 아래로 둘 것: 레이아웃 효과 안의 setState 가 그 수를 넘으면 React 가 오류를 던진다.
 */
export const MAX_SPLIT_PASSES = 32;

/** 블록 목록에서 문제지 블록을 꺼내고 조각을 도로 담는 법 — 모듈 상수로 둘 것(참조가 안정적이어야 한다) */
export interface PaperSplitAdapter<T> {
  paperBlockOf(block: T): PaperBlock | null;
  wrap(block: T, chunk: PaperBlock): T;
}

/** 문제지 블록 그대로 쓰는 어댑터 */
export const PAPER_SPLIT_ADAPTER: PaperSplitAdapter<PaperBlock> = {
  paperBlockOf: (block) => block,
  wrap: (_, chunk) => chunk,
};

interface SplitState<T> {
  /** 이 블록들을 만들어 낸 원본 */
  source: readonly T[];
  /** 그때의 다시 쪼개기 열쇠 */
  resetKey: unknown;
  blocks: readonly T[];
  pass: number;
}

/** 쪼개는 선택 */
interface PaperSplitOptions {
  /** 엔진의 블록 목록에서 `base` 가 시작하는 자리 */
  blockOffset?: number;
  /** 이 값의 참조가 바뀌면 처음부터 다시 쪼갠다 — 높이를 바꾸는 값(그림 주소)을 넘긴다 */
  resetKey?: unknown;
}

interface UsePaperSplitResult<T> {
  /** 쪼갠 뒤의 블록 목록 */
  blocks: readonly T[];
  /** 블록별 분할 가능 여부 — 이 훅의 블록 자리 그대로 */
  splittable: readonly boolean[];
  /** 블록별 강제 넘김 — 간격을 떼고 단 끝에 앉힌 문항 뒤는 다음 단에서 시작한다 */
  breakBefore: readonly BreakBefore[];
  handleSplitRequest: SplitRequestHandler;
}

/**
 * 아직 뜨는 중인 본문 그림이 있는가.
 * ⚠️ 블록 안만 본다 — 머리글 로고는 높이가 정해져 있어 뜨는 순간 다시 재지 않으므로, 기다리면 쪼개기가 영영 안 돈다.
 */
function hasPendingImages(root: HTMLElement): boolean {
  return Array.from(root.querySelectorAll<HTMLImageElement>('[data-measure="block"] img')).some((img) => !img.complete);
}

/** 블록 하나를 정해진 자리에서 잘라 조각 블록들로 */
function cutBlock<T>(block: T, cuts: readonly number[], adapter: PaperSplitAdapter<T>): readonly T[] {
  const paper = adapter.paperBlockOf(block);
  const target = paper ? splitTargetOf(paper) : null;
  if (!target) return [block];
  return target.cut(cuts).map((chunk) => (chunk === paper ? block : adapter.wrap(block, chunk)));
}

/**
 * 긴 지문 문단과 문항을 남은 자리에 맞춰 쪼갠다 — 문제지와 책 내지가 같이 쓴다.
 *
 * 엔진은 블록을 쪼개지 못해서, 자리가 모자라면 그 블록을 통째로 다음 단·쪽으로 옮기고 앞 자리는 빈다(2026-11-06
 * 긴 시 한 편이 1쪽을 비워 두고 넘어간 제보, 긴 문항이 단을 비우거나 줄어 찍힌 제보). 개념지 표와 같은 길
 * (`splittable`·`onSplitRequest`)로 받아 자른다. 무엇을 어떻게 재고 자르는지는 `splitTargetOf` 가 안다.
 *
 * ⚠️ **글꼴과 그림이 다 온 뒤에만 쪼갠다.** 폴백 글꼴로 쪼개면 글꼴이 온 뒤 처음부터 다시 쪼개야 하고, 재는 값이 곧 문서
 *    전체의 레이아웃이라(문제지 160쪽이면 한 번에 0.5초 넘게) 두 번 더 도는 것이 쪼개기 비용의 절반이었다. 엔진은 글꼴이
 *    오면 어차피 다시 재므로(`fonts.ready`) 그 측정이 쪼개기를 부른다 — 받아 두고 기다리는 코드가 필요 없다.
 *    그림도 같다. 뜨기 전 높이로 자르면 자른 자리가 낡고, 단 끝에 앉힌 문항의 '다음 단' 이 엉뚱한 자리에서 쪽을
 *    늘린다(코덱스 2R). 그래서 그림 주소가 오면 `resetKey` 로 처음부터 다시 쪼개고, 뜨는 동안은 기다린다.
 *
 * `blockOffset` 은 이 훅이 맡지 않는 블록이 앞에 몇 개 있는가다 — 책의 목차가 그렇다. 목차 쪽 번호가 채워질 때마다
 * 쪼갠 것이 풀리면 안 되므로 목차는 `base` 밖에 둔다.
 * @param base - 쪼개기 전 블록 목록 (참조가 바뀌면 처음부터 다시 쪼갠다)
 * @param adapter - 문제지 블록을 꺼내고 담는 법
 * @param options - 쪼개는 선택
 * @returns 쪼갠 블록과 엔진에 넘길 값들
 */
export function usePaperSplit<T>(
  base: readonly T[], adapter: PaperSplitAdapter<T>, { blockOffset = 0, resetKey }: PaperSplitOptions = {},
): UsePaperSplitResult<T> {
  const [state, setState] = useState<SplitState<T>>({ source: base, resetKey, blocks: base, pass: 0 });

  // 원본이 바뀌면 렌더 중에 바로 되돌린다 (effect + setState 는 한 프레임 늦다)
  if (state.source !== base || state.resetKey !== resetKey) setState({ source: base, resetKey, blocks: base, pass: 0 });
  const { blocks } = state;

  const splittable = useMemo(() => blocks.map((block) => {
    const paper = adapter.paperBlockOf(block);
    return paper !== null && splitTargetOf(paper) !== null;
  }), [blocks, adapter]);

  // ⚠️ 간격을 뗀 자리에 다음 문항이 번호째 붙으면 간격을 뗀 뜻이 사라진다 — 그 자리는 비워 두어야 한다
  const breakBefore = useMemo(() => blocks.map((_, i): BreakBefore => {
    const previous = i > 0 ? adapter.paperBlockOf(blocks[i - 1]) : null;
    return previous?.kind === 'problem' && previous.tight ? 'column' : false;
  }), [blocks, adapter]);

  const handleSplitRequest = useCallback<SplitRequestHandler>((_, measureRoot, input) => {
    if (state.pass >= MAX_SPLIT_PASSES || !areFontsReady() || hasPendingImages(measureRoot)) return;
    // DOM 읽기는 업데이터 밖에서 끝낸다 (업데이터는 순수해야 한다)
    const blockEls = measureRoot.querySelectorAll<HTMLElement>('[data-measure="block"]');
    const measured = new Map<number, PartMeasure | null>();
    const measureAt = (index: number): PartMeasure | null => {
      if (!measured.has(index)) {
        const block = blocks[index - blockOffset];
        const paper = block === undefined ? null : adapter.paperBlockOf(block);
        const target = paper ? splitTargetOf(paper) : null;
        const blockEl = blockEls[index];
        measured.set(index, target && blockEl ? target.measure(blockEl) : null);
      }
      return measured.get(index) ?? null;
    };

    const cuts = planSplitRound(input, measureAt);
    if (cuts.size === 0) return;
    const next = blocks.flatMap((block, i) => {
      const at = cuts.get(i + blockOffset);
      return at ? cutBlock(block, at, adapter) : [block];
    });
    if (next.length === blocks.length && next.every((block, i) => block === blocks[i])) return;

    // 잰 뒤에 다른 갱신이 끼었으면 이 자르기는 낡은 값이다 — 다음 측정이 다시 정한다
    setState((prev) => (prev.blocks === blocks ? { ...prev, blocks: next, pass: prev.pass + 1 } : prev));
  }, [adapter, blockOffset, blocks, state.pass]);

  return { blocks, splittable, breakBefore, handleSplitRequest };
}
