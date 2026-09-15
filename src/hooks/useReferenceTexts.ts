'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  REFERENCE_SEARCH_DEBOUNCE_MS, REFERENCE_TEXT_LIST_LIMIT,
} from '@/lib/reference-texts/constants';
import { fetchReferenceTextList, searchReferenceTexts } from '@/lib/reference-texts/queries';
import { deleteReferenceText } from '@/lib/reference-texts/save';
import type { ReferenceTextListItem } from '@/types/reference-text';

/**
 * 작품 전문 목록 화면의 상태.
 *
 * 목록은 **최근 고친 순으로 상한(`REFERENCE_TEXT_LIST_LIMIT`)까지**만 읽는다.
 *
 * ⚠️ 그래서 **검색은 서버가 한다**(코덱스 리뷰 3R). 받아 둔 목록에서 거르면 상한을 넘긴 순간
 *    **옛 작품이 제목을 정확히 쳐도 없는 것처럼 보이고**, 이 화면에는 페이지 넘기기가 없어
 *    고치거나 지울 길이 아예 사라진다. 글자마다 물으면 왕복이 너무 늘어 잠깐 기다렸다 묻는다.
 */
export function useReferenceTexts() {
  const [rows, setRows] = useState<ReferenceTextListItem[]>([]);
  /** 아예 한 편도 없는가 — '검색 결과 없음' 과 '아직 안 올림' 을 가른다 */
  const [empty, setEmpty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearchValue] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const aliveRef = useRef(true);
  /** 지우기가 겹치지 않게 하는 잠금. ⚠️ state 가 아니라 ref 다 — 화면의 disabled 는 렌더 뒤다 */
  const busyRef = useRef(false);
  /** 몇 번째 조회인가 — 늦게 온 옛 응답이 새 결과를 덮으면 안 된다 */
  const queryIdRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * 지금 검색어의 거울.
   *
   * ⚠️ 닫아 둔 state 를 쓰면 안 된다(코덱스 리뷰 5R). 지우는 동안 사람이 검색어를 바꾸면,
   *    끝난 뒤의 다시 읽기가 **옛 검색어로** 조회를 새로 걸어 새 검색 결과를 덮는다 —
   *    입력칸과 목록이 어긋난 채로 남는다.
   */
  const searchRef = useRef('');

  /**
   * 목록을 읽는다. 검색어가 있으면 제목·지은이를 따로 물어 합친다.
   *
   * ⚠️ `.or()` 를 쓰지 않는다 — 이스케이프가 인용을 통과하며 풀린다(저장소 공통 규약).
   * @param keyword - 검색어 (빈 값이면 최근 목록)
   */
  const load = useCallback(async (keyword: string) => {
    queryIdRef.current += 1;
    const id = queryIdRef.current;
    try {
      const term = keyword.trim();
      let list: ReferenceTextListItem[];
      if (term === '') {
        list = await fetchReferenceTextList();
      } else {
        const [byTitle, byAuthor] = await Promise.all([
          searchReferenceTexts(term, 'title', REFERENCE_TEXT_LIST_LIMIT),
          searchReferenceTexts(term, 'author', REFERENCE_TEXT_LIST_LIMIT),
        ]);
        // 제목이 맞은 것을 앞에 둔다 — 작품명으로 찾는 일이 대부분이다
        const merged = new Map<string, ReferenceTextListItem>();
        for (const row of [...byTitle, ...byAuthor]) {
          if (!merged.has(row.id)) merged.set(row.id, row);
        }
        list = [...merged.values()];
      }
      if (!aliveRef.current || id !== queryIdRef.current) return;
      setRows(list);
      // 검색 중에는 '아예 없음' 을 판정하지 않는다 — 그건 검색 결과가 없는 것뿐이다
      if (term === '') setEmpty(list.length === 0);
    } catch (e) {
      if (aliveRef.current) {
        toast.error(e instanceof Error ? e.message : '전문 목록을 불러오지 못했어요.');
      }
    } finally {
      if (aliveRef.current && id === queryIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // ⚠️ 효과 본문에서 true 로 되돌린다 — StrictMode 의 setup → cleanup → setup 뒤에
    //    꺼진 채로 남으면 이 화면의 기능이 조용히 통째로 죽는다
    aliveRef.current = true;
    load('');
    return () => {
      aliveRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [load]);

  /** 검색어를 고친다. 글자를 멈춘 뒤에 한 번만 묻는다 */
  const setSearch = useCallback((value: string) => {
    searchRef.current = value;
    setSearchValue(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => load(value), REFERENCE_SEARCH_DEBOUNCE_MS);
  }, [load]);

  const remove = useCallback(async (row: ReferenceTextListItem) => {
    if (busyRef.current) return;
    if (!window.confirm(
      `"${row.title}" 전문을 지울까요?\n`
      + '되돌릴 수 없고, 문제 만들기에서 참고자료로 쓸 수 없게 됩니다.',
    )) return;

    busyRef.current = true;
    setBusyId(row.id);
    try {
      await deleteReferenceText(row.id);
      toast.success('전문을 지웠어요.');
      // 지운 뒤에는 **보고 있던 조건 그대로** 다시 읽는다 — 지역에서 행만 빼면 상한 너머의
      // 다음 작품이 올라오지 않아 목록이 한 줄씩 줄어든 채로 남는다.
      // ⚠️ 닫아 둔 값이 아니라 **지금 검색어**다(지우는 사이에 바뀌었을 수 있다)
      await load(searchRef.current);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '지우지 못했어요.');
    } finally {
      busyRef.current = false;
      if (aliveRef.current) setBusyId(null);
    }
  }, [load]);

  return {
    rows,
    empty,
    loading,
    busyId,
    search,
    setSearch,
    reload: () => load(searchRef.current),
    remove,
  };
}
