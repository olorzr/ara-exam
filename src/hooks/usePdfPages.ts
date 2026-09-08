'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { pdfThumbnails, pdfPageCount, THUMB_WINDOW } from '@/lib/pdf/pdfPages';

/** 쪽을 어떻게 쓸지 */
export type PageRole = 'problem' | 'answer' | 'skip';

/** 기본값 — 대부분의 쪽은 문제 쪽이다 */
const DEFAULT_ROLE: PageRole = 'problem';

export interface PdfPagesState {
  pageCount: number;
  loading: boolean;
  error: string | null;
  /** 지금 보고 있는 썸네일 창의 첫 쪽(1-based) */
  from: number;
  thumbnails: string[];
  roles: Map<number, PageRole>;
}

/**
 * PDF 를 열어 쪽 수를 세고 썸네일을 보여 주며, 쪽마다 역할을 고르게 한다.
 *
 * 썸네일은 **한 번에 다 그리지 않는다**(`THUMB_WINDOW` 장씩). 모의고사처럼 30쪽이 넘는
 * 파일을 통째로 그리면 화면이 몇 초씩 얼어붙는다.
 * @param file - 고른 PDF (없으면 아무것도 하지 않는다)
 * @returns 상태와 조작 함수
 */
export function usePdfPages(file: File | null) {
  const [state, setState] = useState<PdfPagesState>({
    pageCount: 0, loading: false, error: null, from: 1, thumbnails: [], roles: new Map(),
  });
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!file) {
      setState({ pageCount: 0, loading: false, error: null, from: 1, thumbnails: [], roles: new Map() });
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null, from: 1 }));
    (async () => {
      try {
        const count = await pdfPageCount({ kind: 'file', file });
        const thumbs = await pdfThumbnails({ kind: 'file', file }, 1);
        if (!aliveRef.current) return;
        const roles = new Map<number, PageRole>();
        for (let p = 1; p <= count; p += 1) roles.set(p, DEFAULT_ROLE);
        setState({ pageCount: count, loading: false, error: null, from: 1, thumbnails: thumbs, roles });
      } catch (e) {
        if (!aliveRef.current) return;
        setState((s) => ({
          ...s,
          loading: false,
          error: e instanceof Error ? e.message : 'PDF 를 열지 못했어요.',
        }));
      }
    })();
  }, [file]);

  /** 썸네일 창을 옮긴다 — 정답표는 보통 뒤쪽에 있다 */
  const showFrom = useCallback(async (next: number) => {
    if (!file) return;
    setState((s) => ({ ...s, loading: true }));
    try {
      const thumbs = await pdfThumbnails({ kind: 'file', file }, next);
      if (!aliveRef.current) return;
      setState((s) => ({ ...s, from: next, thumbnails: thumbs, loading: false }));
    } catch {
      if (aliveRef.current) setState((s) => ({ ...s, loading: false }));
    }
  }, [file]);

  const setRole = useCallback((page: number, role: PageRole) => {
    setState((s) => {
      const roles = new Map(s.roles);
      roles.set(page, role);
      return { ...s, roles };
    });
  }, []);

  /** 보이는 창의 쪽 전부를 한 역할로 */
  const setRoleForWindow = useCallback((role: PageRole) => {
    setState((s) => {
      const roles = new Map(s.roles);
      const end = Math.min(s.pageCount, s.from + s.thumbnails.length - 1);
      for (let p = s.from; p <= end; p += 1) roles.set(p, role);
      return { ...s, roles };
    });
  }, []);

  const pagesWithRole = useCallback((role: PageRole): number[] => {
    const out: number[] = [];
    state.roles.forEach((value, page) => {
      if (value === role) out.push(page);
    });
    return out.sort((a, b) => a - b);
  }, [state.roles]);

  return {
    ...state,
    windowSize: THUMB_WINDOW,
    showFrom,
    setRole,
    setRoleForWindow,
    pagesWithRole,
  };
}
