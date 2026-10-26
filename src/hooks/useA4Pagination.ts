'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { A4_HEIGHT_PX, getColumnWidth, PAGE_PAD_BOTTOM, PAGE_PAD_TOP } from '@/lib/print/constants';
import {
  blockPagesOf, findBlockPage, paginate, type BreakBefore, type PagePlan, type SplitRequest,
} from '@/lib/print/paginate';

/** 측정값이 이보다 작으면 아직 레이아웃이 안 잡힌 것으로 본다 */
const MIN_SANE_BODY_PX = 80;

/** SSR 에서는 useLayoutEffect 경고가 나므로 useEffect 로 대체 */
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export interface A4Layout {
  pages: PagePlan[];
  /** 배치한 블록 수 — 쪽 알림(`blockPages`)의 길이 */
  blockCount: number;
  /** 블록 인덱스 → 축소 배율. 한 페이지에 안 들어간 블록만 담긴다 */
  oversizedScale: Record<number, number>;
  /** 실측이 끝나 낱장을 그려도 되는 상태 */
  ready: boolean;
}

const EMPTY_LAYOUT: A4Layout = { pages: [], blockCount: 0, oversizedScale: {}, ready: false };

/**
 * 배치 직전에 불린다 — 블록 폭이 정해진 뒤에만 할 수 있는 손질(개념지 표의 열 폭 맞춤)용.
 * 블록을 갱신했으면 `true` 를 돌려준다. 그러면 이번 라운드의 실측은 옛 HTML 기준이므로
 * 분할 요청을 건너뛴다(배치 자체는 그대로 반영해 화면이 비지 않게 한다).
 */
export type BeforePaginateHandler = (measureRoot: HTMLElement, columnWidth: number) => boolean;

/**
 * 남은 자리에 안 들어간 분할 가능 블록이 나왔을 때 호출된다.
 * 블록을 더 잘게 쪼갤 수 있는 쪽(개념지의 긴 표)이 받아서 블록 목록을 갱신한다.
 */
export type SplitRequestHandler = (requests: SplitRequest[], measureRoot: HTMLElement) => void;

/** 배치가 끝났을 때 알려 주는 값 */
export interface A4LayoutInfo {
  /** 그릴 낱장 수 — 빈 쪽·배수 채움까지 센 값(PDF 에 담기는 쪽 수). 표지·뒷표지는 세지 않는다 */
  pageCount: number;
  /**
   * 블록마다 놓인 쪽(0-based, 표지는 세지 않는다). 인쇄 쪽 번호는 +1. 책 목차가 장의 시작 쪽을 찍는 데 쓴다.
   * 어느 쪽에도 없는 블록은 -1.
   */
  blockPages: readonly number[];
}

/** 배치가 바뀔 때마다 불린다 — 안정적인 참조여야 한다(useCallback) */
export type LayoutHandler = (info: A4LayoutInfo) => void;

interface UseA4PaginationArgs {
  columns: 1 | 2;
  /** 블록별 '행 단위로 더 쪼갤 수 있음' 표시. 참조가 안정적이어야 한다(useMemo) */
  splittable?: readonly boolean[];
  /** 블록별 강제 쪽 넘김(책의 장 시작). 참조가 안정적이어야 한다(useMemo) */
  breakBefore?: readonly BreakBefore[];
  /** 쪽 수를 이 배수로 맞춘다(무선제본 내지 4) */
  padPagesTo?: number;
  onBeforePaginate?: BeforePaginateHandler;
  onSplitRequest?: SplitRequestHandler;
  /** 배치가 정해지거나 바뀌면 쪽 수를 알린다(책의 책등 두께 계산) */
  onLayout?: LayoutHandler;
}

interface UseA4PaginationResult {
  /** 숨김 측정 컨테이너에 연결할 ref */
  measureRootRef: React.RefObject<HTMLDivElement | null>;
  layout: A4Layout;
}

/**
 * 숨김 컨테이너에 렌더된 블록들의 실제 높이를 재서 A4 낱장 배치를 계산한다.
 *
 * 폰트(CDN)·이미지 로딩으로 높이가 나중에 바뀌므로 fonts.ready / ResizeObserver /
 * beforeprint 로 재측정한다. 결과가 같으면 state 를 갱신하지 않아 렌더 루프가 없다.
 */
export function useA4Pagination({
  columns,
  splittable,
  breakBefore,
  padPagesTo,
  onBeforePaginate,
  onSplitRequest,
  onLayout,
}: UseA4PaginationArgs): UseA4PaginationResult {
  const measureRootRef = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState<A4Layout>(EMPTY_LAYOUT);
  const signatureRef = useRef('');

  const measure = useCallback(() => {
    const root = measureRootRef.current;
    if (!root) return;

    const heightOf = (selector: string) => {
      const el = root.querySelector<HTMLElement>(selector);
      return el ? el.getBoundingClientRect().height : 0;
    };

    const footerHeight = heightOf('[data-measure="footer"]');
    const firstHeaderHeight = heightOf('[data-measure="first-header"]');
    const laterHeaderHeight = heightOf('[data-measure="later-header"]');
    const columnHeaderHeight = heightOf('[data-measure="column-header"]');
    const blockHeights = Array.from(root.querySelectorAll<HTMLElement>('[data-measure="block"]')).map(
      (el) => el.getBoundingClientRect().height,
    );

    const shell = PAGE_PAD_TOP + PAGE_PAD_BOTTOM + footerHeight;
    const firstPageBodyHeight = A4_HEIGHT_PX - shell - firstHeaderHeight;
    const laterPageBodyHeight = A4_HEIGHT_PX - shell - laterHeaderHeight;

    // 인쇄 대화상자에서는 측정 컨테이너가 display:none 이라 전부 0 으로 읽힌다.
    // 그때는 직전 배치를 그대로 유지해야 한다 (0 으로 다시 계산하면 페이지가 무너진다).
    if (footerHeight <= 0 || firstPageBodyHeight < MIN_SANE_BODY_PX) return;

    // 폭이 정해진 뒤에만 할 수 있는 손질(표 열 폭 맞춤). 블록이 바뀌었으면 지금 잰 높이는
    // 옛 HTML 기준이라 아래에서 분할 요청만 건너뛴다 — 배치는 그대로 반영해야 화면이 비지 않는다
    const refitted = onBeforePaginate?.(root, getColumnWidth(columns)) ?? false;

    const { pages, oversized, splitRequests } = paginate({
      blockHeights,
      columns,
      firstPageBodyHeight,
      laterPageBodyHeight,
      columnHeaderHeight,
      splittable,
      breakBefore,
      padPagesTo,
    });

    const oversizedScale: Record<number, number> = {};
    oversized.forEach((index) => {
      const pageIndex = findBlockPage(pages, index);
      const body = pageIndex === 0 ? firstPageBodyHeight : laterPageBodyHeight;
      const capacity = body - columnHeaderHeight;
      const height = blockHeights[index] ?? 0;
      if (height <= 0 || capacity <= 0) return;
      // 하한을 두면 덜 줄어든 만큼이 overflow:hidden 에 잘려 사라진다 — 반드시 페이지에 맞춘다
      oversizedScale[index] = Math.min(1, capacity / height);
    });

    // 남은 자리에 안 들어간 표는 호출부가 나눠 준다 — 지금 페이지를 채우고 다음으로 이어진다.
    // 배치 결과가 그대로여도 콘텐츠가 바뀌었을 수 있으므로 아래 bail-out 보다 먼저 호출한다.
    // (핸들러는 안정적인 참조여야 하고, 쪼갤 게 없으면 state 를 그대로 두어 루프가 없다)
    if (!refitted && splitRequests.length > 0) onSplitRequest?.(splitRequests, root);

    const next: A4Layout = { pages, blockCount: blockHeights.length, oversizedScale, ready: true };
    const signature = JSON.stringify(next);
    if (signature === signatureRef.current) return;
    signatureRef.current = signature;
    setLayout(next);
  }, [columns, splittable, breakBefore, padPagesTo, onBeforePaginate, onSplitRequest]);

  // 렌더마다 확인 — 블록이 바뀌면 paint 전에 배치가 갱신된다
  useIsoLayoutEffect(measure);

  // 쪽 수는 `measure()` 안이 아니라 **커밋 뒤** 알린다 — `layout` 은 서명이 바뀔 때만 새 객체라
  // 실제로 배치가 바뀐 횟수만큼만 불린다(남의 콜백을 부를 뿐 이 훅의 state 는 건드리지 않는다)
  useEffect(() => {
    if (!layout.ready) return;
    onLayout?.({ pageCount: layout.pages.length, blockPages: blockPagesOf(layout.pages, layout.blockCount) });
  }, [layout, onLayout]);

  useEffect(() => {
    const root = measureRootRef.current;
    if (!root) return;

    const remeasure = () => measure();

    let frame = 0;
    const scheduleRemeasure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(remeasure);
    };

    // CDN 폰트가 늦게 적용되면 모든 높이가 바뀐다
    document.fonts?.ready.then(remeasure).catch(() => {});

    const observer = new ResizeObserver(scheduleRemeasure);
    observer.observe(root);

    const images = Array.from(root.querySelectorAll('img'));
    images.forEach((img) => img.addEventListener('load', scheduleRemeasure));

    window.addEventListener('beforeprint', remeasure);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      images.forEach((img) => img.removeEventListener('load', scheduleRemeasure));
      window.removeEventListener('beforeprint', remeasure);
    };
  }, [measure]);

  return { measureRootRef, layout };
}
