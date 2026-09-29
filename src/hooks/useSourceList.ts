'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { fetchSources, refetchSources, type SourceListRow } from '@/lib/problem-bank/source-list';
import type { SourceListQuery } from '@/lib/problem-bank/source-list-filters';

/** 읽어 둔 목록 — **어느 조건의 것인지와 함께** 든다 */
interface LoadedList {
  key: string;
  rows: SourceListRow[];
  total: number;
}

/**
 * '올라간 기출' 목록 상태 — 조건·'더 보기'·지운 뒤 다시 읽기.
 *
 * ⚠️ 목록은 offset 으로 이어 받는데 **행을 지울 수 있다.** 한 행이 사라지면 뒤쪽 offset 이
 *    전부 하나씩 당겨지므로, 지운 뒤에는 펼친 만큼을 0쪽부터 다시 읽는다(`syncLoaded`).
 *    그 재조회가 실패하면 '더 보기' 를 닫고 다시 읽기만 내준다(`needsResync`) — 어긋난
 *    목록에 이어 받으면 경계에 걸린 행이 조용히 빠진다(코덱스 리뷰 P1·P2).
 * ⚠️ 모든 요청은 **세대 번호**(`reqSeq`)를 든다. 조건 바꾸기·'더 보기'·다시 읽기가 겹치면
 *    늦게 온 옛 응답이 새 목록을 덮어써 목록과 펼친 쪽 수가 어긋난다.
 * ⚠️ 로딩은 state 가 아니라 **"무엇을 읽어 두었는가" 에서 파생**한다 — 효과 안에서
 *    setState 를 동기로 부르면 lint(`set-state-in-effect`)가 막는다.
 * @param query - 지금 조건
 * @returns 목록과 조작
 */
export function useSourceList(query: SourceListQuery) {
  const key = JSON.stringify(query);
  const [list, setList] = useState<LoadedList | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [needsResync, setNeedsResync] = useState(false);
  /** 지금 조건으로 펼친 쪽 수 — 요청하는 순간의 값을 읽어야 해서 ref 다 */
  const loadedPagesRef = useRef(1);
  const reqSeq = useRef(0);
  /** 지금 조건 — 지운 뒤 다시 읽기가 옛 조건으로 읽지 않게 */
  const keyRef = useRef(key);

  useEffect(() => {
    keyRef.current = key;
    const seq = ++reqSeq.current;
    const wanted = JSON.parse(key) as SourceListQuery;
    fetchSources({ query: wanted })
      .then((page) => {
        if (seq !== reqSeq.current) return;
        loadedPagesRef.current = 1;
        setNeedsResync(false);
        setList({ key, rows: page.rows, total: page.total });
      })
      .catch((e) => {
        if (seq !== reqSeq.current) return;
        toast.error(e instanceof Error ? e.message : '목록을 불러오지 못했어요.');
        // 비운 목록을 이 조건의 결과로 남긴다 — 옛 조건의 줄이 새 조건의 것처럼 보이면 안 된다
        setList({ key, rows: [], total: 0 });
      });
    // 화면을 떠나면 늦게 온 응답을 버린다
    return () => { reqSeq.current += 1; };
  }, [key]);

  /** 목록은 끊어 온다 — 상한만 걸면 옛 출처가 조용히 사라진다 */
  const loadMore = useCallback(async () => {
    if (loadingMore || needsResync || list?.key !== keyRef.current) return;
    const seq = ++reqSeq.current;
    const wantedKey = keyRef.current;
    setLoadingMore(true);
    try {
      const next = await fetchSources({
        query: JSON.parse(wantedKey) as SourceListQuery,
        page: loadedPagesRef.current,
      });
      // 그 사이 조건 바꾸기·삭제가 끼어들었으면 버린다(쪽 수도 올리지 않는다)
      if (seq !== reqSeq.current) return;
      setList((prev) => (prev && prev.key === wantedKey
        ? { key: wantedKey, rows: [...prev.rows, ...next.rows], total: next.total }
        : prev));
      loadedPagesRef.current += 1;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '더 불러오지 못했어요.');
    } finally {
      setLoadingMore(false);
    }
  }, [list?.key, loadingMore, needsResync]);

  /** 펼쳐 둔 만큼을 **0쪽부터 통째로** 다시 읽는다 — 펼친 쪽 수는 그대로 둔다 */
  const syncLoaded = useCallback(async () => {
    const seq = ++reqSeq.current;
    const wantedKey = keyRef.current;
    try {
      const page = await refetchSources(
        loadedPagesRef.current, JSON.parse(wantedKey) as SourceListQuery,
      );
      if (seq !== reqSeq.current) return;
      setList({ key: wantedKey, rows: page.rows, total: page.total });
      setNeedsResync(false);
    } catch (e) {
      if (seq !== reqSeq.current) return;
      setNeedsResync(true);
      toast.error(e instanceof Error ? e.message : '목록을 다시 읽지 못했어요.');
    }
  }, []);

  /** 지운 줄을 먼저 걷고 다시 읽는다 — 다시 읽는 동안 남아 있으면 "왜 안 지워졌지" 가 된다 */
  const afterDelete = useCallback(async (deletedId: string) => {
    setList((prev) => (prev ? { ...prev, rows: prev.rows.filter((r) => r.id !== deletedId) } : prev));
    await syncLoaded();
  }, [syncLoaded]);

  return {
    rows: list?.rows ?? [],
    total: list?.total ?? 0,
    /** 처음 읽는 중 (아직 보여 줄 것이 없다) */
    initialLoading: list === null,
    /** 조건을 바꿔 다시 읽는 중 (옛 목록을 흐리게 둔다) */
    refreshing: list !== null && list.key !== key,
    loadingMore,
    needsResync,
    loadMore,
    syncLoaded,
    afterDelete,
  };
}
