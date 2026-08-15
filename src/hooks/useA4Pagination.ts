'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  A4_HEIGHT_PX,
  CAPACITY_SAFETY_PX,
  OVERSIZED_MIN_SCALE,
  PAGE_PAD_BOTTOM,
  PAGE_PAD_TOP,
} from '@/lib/print/constants';
import { findBlockPage, paginate, type PagePlan } from '@/lib/print/paginate';

/** 측정값이 이보다 작으면 아직 레이아웃이 안 잡힌 것으로 본다 */
const MIN_SANE_BODY_PX = 80;

/** SSR 에서는 useLayoutEffect 경고가 나므로 useEffect 로 대체 */
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export interface A4Layout {
  pages: PagePlan[];
  /** 블록 인덱스 → 축소 배율. 한 페이지에 안 들어간 블록만 담긴다 */
  oversizedScale: Record<number, number>;
  /** 실측이 끝나 낱장을 그려도 되는 상태 */
  ready: boolean;
}

const EMPTY_LAYOUT: A4Layout = { pages: [], oversizedScale: {}, ready: false };

export type RemeasureKey = string | number | boolean | undefined;

/**
 * 한 페이지에 통째로 담기지 않는 블록이 나왔을 때 호출된다.
 * 블록을 더 잘게 쪼갤 수 있는 쪽(개념지의 긴 표 등)이 받아서 블록 목록을 갱신한다.
 */
export type OversizedHandler = (
  indices: number[],
  measureRoot: HTMLElement,
  /** 한 컬럼이 쓸 수 있는 최대 높이(px) */
  capacity: number,
) => void;

interface UseA4PaginationArgs {
  columns: 1 | 2;
  /** 값이 바뀌면 캐시를 무시하고 다시 측정한다 (본문 HTML, 문항 수 등) */
  remeasureKey?: RemeasureKey;
  onOversized?: OversizedHandler;
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
  remeasureKey,
  onOversized,
}: UseA4PaginationArgs): UseA4PaginationResult {
  const measureRootRef = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState<A4Layout>(EMPTY_LAYOUT);
  const signatureRef = useRef('');
  const fingerprintRef = useRef('');

  const measure = useCallback(() => {
    const root = measureRootRef.current;
    if (!root) return;

    // 값이 그대로면 비싼 DOM 읽기를 건너뛴다 (부모 리렌더마다 전체 측정 방지)
    const fingerprint = `${String(remeasureKey)}|${columns}|${root.getBoundingClientRect().height}`;
    if (fingerprint === fingerprintRef.current) return;
    fingerprintRef.current = fingerprint;

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

    if (footerHeight <= 0 || firstPageBodyHeight < MIN_SANE_BODY_PX) {
      fingerprintRef.current = '';
      return;
    }

    const { pages, oversized } = paginate({
      blockHeights,
      columns,
      firstPageBodyHeight,
      laterPageBodyHeight,
      columnHeaderHeight,
    });

    const oversizedScale: Record<number, number> = {};
    oversized.forEach((index) => {
      const pageIndex = findBlockPage(pages, index);
      const body = pageIndex === 0 ? firstPageBodyHeight : laterPageBodyHeight;
      const capacity = body - columnHeaderHeight;
      const height = blockHeights[index] ?? 0;
      if (height <= 0 || capacity <= 0) return;
      oversizedScale[index] = Math.max(OVERSIZED_MIN_SCALE, Math.min(1, capacity / height));
    });

    const next: A4Layout = { pages, oversizedScale, ready: true };
    const signature = JSON.stringify(next);
    if (signature === signatureRef.current) return;
    signatureRef.current = signature;
    setLayout(next);

    // 더 잘게 쪼갤 수 있는 블록이면 호출부가 다시 나눠 준다 (개념지의 긴 표).
    // 핸들러는 안정적인 참조여야 한다 — 렌더마다 새로 만들면 측정이 매번 다시 붙는다.
    if (oversized.length > 0) {
      const capacity = laterPageBodyHeight - columnHeaderHeight - CAPACITY_SAFETY_PX;
      onOversized?.(oversized, root, capacity);
    }
  }, [columns, remeasureKey, onOversized]);

  // 렌더마다 확인 — 블록이 바뀌면 paint 전에 배치가 갱신된다
  useIsoLayoutEffect(measure);

  useEffect(() => {
    const root = measureRootRef.current;
    if (!root) return;

    // 측정을 강제로 다시 하려면 지문을 비워야 한다
    const remeasure = () => {
      fingerprintRef.current = '';
      measure();
    };

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
