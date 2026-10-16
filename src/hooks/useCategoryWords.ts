'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { fetchCategoryWords } from '@/lib/words-mutations';
import type { Word } from '@/types';

/**
 * 읽어 둔 단어 목록 — **어느 카테고리의 목록인가**와 한 덩어리다(2026-10-15 리뷰 1번).
 *
 * ⚠️ 예전에는 고른 카테고리와 `words` 를 따로 두고 조회에 세대 검사도 없어서, A 를 읽는 사이
 *    B 를 고르면 늦게 온 A 응답이 B 화면의 목록이 됐다. 그 상태에서 '전체 선택 → 삭제' 를 하면
 *    **화면에는 B 인데 A 의 단어가 지워졌다.** 이제 목록은 고른 카테고리와 같은 id 일 때만 보인다.
 */
interface LoadedWords {
  categoryId: string;
  words: Word[];
}

/** 지금 카테고리의 목록이 없을 때 내주는 배열 — 렌더마다 새 배열을 만들지 않는다 */
const NO_WORDS: Word[] = [];

/**
 * 단어 관리 화면의 **고른 카테고리 하나의 단어 목록**.
 *
 * 목록을 읽는 중이거나 못 읽었으면 `words` 는 빈 배열이고 `ready` 는 false 다 — 부르는 쪽은
 * `ready` 가 아니면 어떤 쓰기도 하지 않는다(옛 카테고리 목록으로 쓰지 않는다).
 * @param selectedId - 지금 고른 카테고리 id (없으면 null)
 * @returns 목록·상태와 읽기·고치기 함수
 */
export function useCategoryWords(selectedId: string | null) {
  const [loaded, setLoaded] = useState<LoadedWords | null>(null);
  /** 목록을 못 읽은 카테고리 id — 지금 고른 것과 같을 때만 '실패' 다 */
  const [failedId, setFailedId] = useState<string | null>(null);
  /**
   * 목록 요청의 세대 번호.
   * ⚠️ 응답이 오면 **자기 세대가 마지막일 때만** 반영한다 — 늦게 온 성공이 다른 카테고리의 목록을
   *    들이거나, 늦게 온 실패가 최신 목록을 '실패' 로 덮으면 안 된다(`useSourceList` 의 reqSeq 와 같다).
   */
  const reqSeqRef = useRef(0);
  /** 마지막으로 읽기 시작한 카테고리 = 지금 고른 카테고리 (지운 뒤에는 null) */
  const latestIdRef = useRef<string | null>(null);

  /**
   * 그 카테고리의 목록을 읽는다 — 마지막 요청의 응답만 반영한다.
   * ⚠️ 들고 있던 목록은 **카테고리가 같아도** 버린다(코덱스 1R). A → B → A 로 돌아오면 옛 A 목록이
   *    곧바로 지금 목록이 되고, 다시 읽기가 실패해도 그 목록으로 쓰기가 이어진다.
   */
  const load = useCallback(async (categoryId: string) => {
    const seq = ++reqSeqRef.current;
    latestIdRef.current = categoryId;
    setLoaded(null);
    setFailedId(null);
    try {
      const rows = await fetchCategoryWords(categoryId);
      if (seq !== reqSeqRef.current) return;
      setLoaded({ categoryId, words: rows });
    } catch {
      if (seq !== reqSeqRef.current) return;
      setFailedId(categoryId);
      toast.error('단어를 불러오지 못했어요. 다시 시도해 주세요.');
    }
  }, []);

  /** 지금 카테고리의 목록을 처음부터 다시 읽는다 ('다시 시도' 단추) */
  const reload = useCallback(() => {
    if (selectedId) void load(selectedId);
  }, [selectedId, load]);

  /**
   * 쓰기를 시작한 그 카테고리가 **아직 고른 카테고리일 때만** 다시 읽는다.
   * ⚠️ 쓰는 사이 다른 카테고리로 옮겼는데 옛 카테고리를 다시 읽으면, 세대가 올라 새 카테고리의
   *    조회가 버려지고 옛 목록만 와서 **새 화면이 영영 '불러오는 중'** 에 머문다(코덱스 1R).
   * @param categoryId - 쓰기를 시작할 때의 카테고리 id
   */
  const reloadIfCurrent = useCallback((categoryId: string) => {
    if (latestIdRef.current === categoryId) void load(categoryId);
  }, [load]);

  /**
   * 그 카테고리가 아직 고른 카테고리인가 — 쓰기가 끝난 뒤 화면 상태(선택 모드)를 건드릴지 정한다.
   * 이벤트 처리 중에만 부른다(렌더 중에 ref 를 읽지 않는다).
   */
  const isCurrent = useCallback((categoryId: string) => latestIdRef.current === categoryId, []);

  /** 목록을 버린다 (카테고리를 지운 뒤) — 뒤늦은 응답도 버리게 세대를 올린다 */
  const clear = useCallback(() => {
    reqSeqRef.current += 1;
    latestIdRef.current = null;
    setLoaded(null);
    setFailedId(null);
  }, []);

  /** 쓰기가 끝난 뒤 **그 카테고리의 목록에서만** 행을 뺀다 — 그 사이 다른 카테고리로 갔으면 건드리지 않는다 */
  const drop = useCallback((categoryId: string, ids: readonly string[]) => {
    const gone = new Set(ids);
    setLoaded((prev) => (prev && prev.categoryId === categoryId
      ? { ...prev, words: prev.words.filter((w) => !gone.has(w.id)) }
      : prev));
  }, []);

  /** 그 카테고리의 목록에서 한 행을 고친다 */
  const patch = useCallback((categoryId: string, id: string, fields: Pick<Word, 'word' | 'meaning'>) => {
    setLoaded((prev) => (prev && prev.categoryId === categoryId
      ? { ...prev, words: prev.words.map((w) => (w.id === id ? { ...w, ...fields } : w)) }
      : prev));
  }, []);

  const ready = selectedId !== null && loaded?.categoryId === selectedId;
  const failed = selectedId !== null && !ready && failedId === selectedId;
  return {
    words: ready && loaded ? loaded.words : NO_WORDS,
    ready,
    loading: selectedId !== null && !ready && !failed,
    failed,
    load, reload, reloadIfCurrent, isCurrent, clear, drop, patch,
  };
}
