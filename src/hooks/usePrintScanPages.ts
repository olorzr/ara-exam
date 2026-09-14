'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { pdfPageCount, pdfThumbnails, THUMB_WINDOW } from '@/lib/pdf/pdfPages';
import { kstYear } from '@/lib/kst-year';
import {
  assignPage, assignPages, newBundleDraft, pagesOfBundle, unassignBundle,
  type BundleDraft, type PageAssignment,
} from '@/lib/print-scan/bundles';

/**
 * 스캔 PDF 를 열어 썸네일을 보여 주고, 쪽마다 **어느 묶음(프린트)** 인지 고르게 한다.
 *
 * `usePdfPages`(기출)와 뼈대가 같지만 고르는 것이 다르다 — 거기는 역할 세 가지 중 하나이고
 * 여기는 **묶음 목록 자체가 자란다**. 그래서 상태가 훨씬 크고(묶음 초안 + 활성 묶음),
 * 기본값도 반대다: 기출은 모든 쪽이 '문제', 여기는 **아무 쪽도 배정되지 않은 채로 시작**한다
 * (한 스캔에서 실제로 쓰는 쪽은 일부인 경우가 많다).
 *
 * 두 가지는 반드시 그대로 물려받는다:
 *  ① 파일이 바뀌면 옛 상태를 **렌더 단계에서** 버린다(효과로 되돌리면 한 박자 늦어
 *     엉뚱한 쪽이 읽기로 넘어간다).
 *  ② 요청 세대(`genRef`) — 첫 PDF 를 그리는 중에 다른 PDF 를 고르면 두 요청이 다 살아 있다.
 */

interface ScanPagesState {
  pageCount: number;
  loading: boolean;
  error: string | null;
  /** 지금 보고 있는 썸네일 창의 첫 쪽(1-based) */
  from: number;
  thumbnails: string[];
  bundles: BundleDraft[];
  assignments: PageAssignment;
  /** 지금 쪽을 넣을 묶음 */
  activeId: string;
}

interface FileScopedState extends ScanPagesState {
  forFile: File | null;
}

function pendingState(file: File | null): FileScopedState {
  return {
    forFile: file,
    pageCount: 0,
    loading: file !== null,
    error: null,
    from: 1,
    thumbnails: [],
    bundles: [],
    assignments: new Map(),
    activeId: '',
  };
}

/**
 * @param file - 고른 스캔 PDF (없으면 아무것도 하지 않는다)
 * @returns 상태와 조작 함수
 */
export function usePrintScanPages(file: File | null) {
  const [stored, setState] = useState<FileScopedState>(() => pendingState(null));
  // 파일이 바뀌면 **즉시** 옛 쪽·묶음을 버린다(렌더 단계 파생)
  const state: ScanPagesState = stored.forFile === file ? stored : pendingState(file);
  const aliveRef = useRef(true);
  const genRef = useRef(0);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  useEffect(() => {
    const gen = ++genRef.current;
    const fresh = () => aliveRef.current && genRef.current === gen;
    if (!file) return;

    (async () => {
      try {
        const count = await pdfPageCount({ kind: 'file', file });
        const thumbs = await pdfThumbnails({ kind: 'file', file }, 1);
        if (!fresh()) return;
        // 묶음 하나를 미리 만들어 둔다 — 첫 화면에서 '묶음 추가' 를 먼저 눌러야 하면
        // 쪽을 고를 수가 없어 막힌 것처럼 보인다
        const first = newBundleDraft(crypto.randomUUID(), null, String(kstYear()));
        setState({
          forFile: file,
          pageCount: count,
          loading: false,
          error: null,
          from: 1,
          thumbnails: thumbs,
          bundles: [first],
          assignments: new Map(),
          activeId: first.localId,
        });
      } catch (e) {
        if (!fresh()) return;
        // 여는 데 실패해도 **비운 채로** 둔다 — 옛 파일의 선택을 물려주지 않는다
        setState({
          ...pendingState(file),
          loading: false,
          error: e instanceof Error ? e.message : 'PDF 를 열지 못했어요.',
        });
      }
    })();
  }, [file]);

  /** 썸네일 창을 옮긴다 */
  const showFrom = useCallback(async (next: number) => {
    if (!file) return;
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

  /** 새 묶음을 만들고 활성으로 — 앞 묶음의 학교·년도·학년을 물려받는다 */
  const addBundle = useCallback(() => {
    setState((s) => {
      const draft = newBundleDraft(
        crypto.randomUUID(),
        s.bundles[s.bundles.length - 1] ?? null,
        String(kstYear()),
      );
      return { ...s, bundles: [...s.bundles, draft], activeId: draft.localId };
    });
  }, []);

  const updateBundle = useCallback((localId: string, patch: Partial<BundleDraft>) => {
    setState((s) => ({
      ...s,
      bundles: s.bundles.map((b) => (b.localId === localId ? { ...b, ...patch } : b)),
    }));
  }, []);

  /** 묶음을 지운다 — 그 묶음에 배정된 쪽은 '건너뜀' 으로 돌아간다 */
  const removeBundle = useCallback((localId: string) => {
    setState((s) => {
      const bundles = s.bundles.filter((b) => b.localId !== localId);
      const activeId = s.activeId === localId
        ? bundles[bundles.length - 1]?.localId ?? ''
        : s.activeId;
      return { ...s, bundles, assignments: unassignBundle(s.assignments, localId), activeId };
    });
  }, []);

  const setActive = useCallback((localId: string) => {
    setState((s) => ({ ...s, activeId: localId }));
  }, []);

  /** 누르면 활성 묶음에 넣고, 이미 그 묶음이면 뺀다 */
  const togglePage = useCallback((page: number) => {
    setState((s) => {
      if (!s.activeId) return s;
      const current = s.assignments.get(page);
      return {
        ...s,
        assignments: assignPage(s.assignments, page, current === s.activeId ? null : s.activeId),
      };
    });
  }, []);

  /** 보이는 창의 쪽 전부를 활성 묶음에 (localId 가 null 이면 전부 건너뜀으로) */
  const assignWindow = useCallback((toActive: boolean) => {
    setState((s) => {
      const end = Math.min(s.pageCount, s.from + s.thumbnails.length - 1);
      const pages: number[] = [];
      for (let p = s.from; p <= end; p += 1) pages.push(p);
      return {
        ...s,
        assignments: assignPages(s.assignments, pages, toActive ? s.activeId || null : null),
      };
    });
  }, []);

  return {
    ...state,
    /** 이 파일로 읽기를 시작해도 되는가 — 다 열렸고 오류가 없을 때만 */
    ready: !state.loading && !state.error && state.pageCount > 0,
    windowSize: THUMB_WINDOW,
    pagesOf: (localId: string) => pagesOfBundle(state.assignments, localId),
    showFrom,
    addBundle,
    updateBundle,
    removeBundle,
    setActive,
    togglePage,
    assignWindow,
  };
}
