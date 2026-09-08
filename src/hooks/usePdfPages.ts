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
  /**
   * 지금 유효한 요청의 세대.
   *
   * ⚠️ 언마운트 여부(`aliveRef`)만 보면 부족하다 — 첫 PDF 를 그리는 중에 다른 PDF 를 고르면
   *    **두 요청이 다 살아 있고**, 먼저 시작한 쪽이 나중에 끝나면서 새 파일의 쪽 수·역할을
   *    옛 것으로 덮어쓴다. 그 상태로 읽기를 시작하면 엉뚱한 쪽이 OCR 로 간다(코덱스 리뷰 2R).
   */
  const genRef = useRef(0);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    const gen = ++genRef.current;
    const fresh = () => aliveRef.current && genRef.current === gen;

    if (!file) {
      setState({ pageCount: 0, loading: false, error: null, from: 1, thumbnails: [], roles: new Map() });
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null, from: 1 }));
    (async () => {
      try {
        const count = await pdfPageCount({ kind: 'file', file });
        const thumbs = await pdfThumbnails({ kind: 'file', file }, 1);
        if (!fresh()) return;
        const roles = new Map<number, PageRole>();
        for (let p = 1; p <= count; p += 1) roles.set(p, DEFAULT_ROLE);
        setState({ pageCount: count, loading: false, error: null, from: 1, thumbnails: thumbs, roles });
      } catch (e) {
        if (!fresh()) return;
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
    // 여기서도 세대를 확인한다. 창을 넘기는 도중에 다른 파일을 고르면
    // 옛 파일의 썸네일이 새 파일 위에 얹힌다
    const gen = genRef.current;
    const fresh = () => aliveRef.current && genRef.current === gen;

    setState((s) => ({ ...s, loading: true }));
    try {
      const thumbs = await pdfThumbnails({ kind: 'file', file }, next);
      if (!fresh()) return;
      setState((s) => ({ ...s, from: next, thumbnails: thumbs, loading: false }));
    } catch {
      if (fresh()) setState((s) => ({ ...s, loading: false }));
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
