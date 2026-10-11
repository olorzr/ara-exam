'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  EMPTY_FILTERS, toProblemQuery, type ProblemFilters,
} from '@/lib/problem-bank/filters';
import {
  EMPTY_SOURCE_FACETS, fetchAreaFacets, fetchGrammarFacets, fetchSourceFacets, fetchUnitFacets,
  fetchWorkFacets, type GrammarFacet, type SourceFacets, type WorkFacet,
} from '@/lib/problem-bank/facets';
import { fetchProblemPage, PROBLEM_PAGE_SIZE } from '@/lib/problem-bank/queries';
import type { Problem, ProblemSource } from '@/types/problem-bank';
import { useDebouncedValue } from './useDebouncedValue';

/**
 * 검색어를 치는 동안 목록 조회를 미루는 시간.
 * 검색은 문항 29,000행을 훑는 조회라(sql/66 — RLS 때문에 인덱스를 못 쓴다) 글자마다 보내면
 * 앞 조회가 끝나기 전에 다음 조회가 쌓인다.
 */
export const ARCHIVE_SEARCH_DEBOUNCE_MS = 300;

export type ArchiveRow = Problem & { source: ProblemSource };

/**
 * 아카이브 목록 상태.
 *
 * 목록은 **반드시 페이지를 나눈다** — PostgREST 는 기본 1,000행에서 조용히 잘려서
 * "전부 봤다"고 착각하기 쉽다.
 * @param initial - 첫 필터 (주소에서 복원한 값)
 */
export function useProblemArchive(initial: ProblemFilters = EMPTY_FILTERS) {
  const [filters, setFilters] = useState<ProblemFilters>(initial);
  const [rows, setRows] = useState<ArchiveRow[]>([]);
  const [total, setTotal] = useState(0);
  // 로딩을 state 로 두고 효과에서 켜면 렌더가 한 번 더 돈다.
  // "무엇을 이미 불러왔는가"만 기억하고 로딩은 **파생**한다.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  /** 조건이 같아도 다시 읽게 하는 세대 번호 (지운 뒤 목록 갱신) */
  const [reloadSeq, setReloadSeq] = useState(0);
  const [facets, setFacets] = useState<SourceFacets>(EMPTY_SOURCE_FACETS);
  const [areaFacets, setAreaFacets] = useState<string[][]>([]);
  const [unitFacets, setUnitFacets] = useState<string[][]>([]);
  /** 문법 분류는 원소가 경로 문자열이고 문항 수를 함께 들고 있어 다른 패싯과 모양이 다르다 */
  const [grammarFacets, setGrammarFacets] = useState<GrammarFacet[]>([]);
  const [workFacets, setWorkFacets] = useState<WorkFacet[]>([]);

  // 다섯 패싯은 RPC 한 번(sql/66)을 나눠 쓴다 — 캐시(facets-cache.ts)가 한 요청만 보낸다.
  // `reload()`(선택 삭제·일괄 태깅 뒤)에도 다시 읽는다: 그 쓰기가 캐시를 이미 무효화해 두었다.
  // ⚠️ 늦게 끝난 옛 응답이 새 응답을 덮지 않게, 정리된 효과의 결과는 버린다.
  useEffect(() => {
    let alive = true;
    const keep = <T,>(set: (v: T) => void) => (v: T) => { if (alive) set(v); };
    fetchSourceFacets().then(keep(setFacets)).catch(() => { /* 선택지가 없어도 목록은 본다 */ });
    fetchAreaFacets().then(keep(setAreaFacets)).catch(() => { /* 영역 필터만 빠진다 */ });
    fetchUnitFacets().then(keep(setUnitFacets)).catch(() => { /* 단원 필터만 빠진다 */ });
    fetchGrammarFacets().then(keep(setGrammarFacets)).catch(() => { /* 문법 건수만 빠진다 */ });
    fetchWorkFacets().then(keep(setWorkFacets)).catch(() => { /* 작품 트리만 빠진다 */ });
    return () => {
      alive = false;
    };
  }, [reloadSeq]);

  /**
   * 경로 → 문항 수. 트리·선택지가 마스터를 그리면서 여기서 건수만 얹는다.
   * 조회가 실패해도 빈 Map 이라 트리는 전부 0건으로 멀쩡히 그려진다.
   */
  const grammarCounts = useMemo(
    () => new Map(grammarFacets.map((f) => [f.path, f.count])),
    [grammarFacets],
  );

  // 검색어는 입력칸·주소에는 친 그대로 두고, **목록 조회에만** 손이 멈춘 뒤에 싣는다.
  // 지우면(빈 검색어) 기다리지 않는다 — '조건 지우기' 가 바로 반영돼야 한다.
  const settledSearch = useDebouncedValue(filters.search, ARCHIVE_SEARCH_DEBOUNCE_MS);
  const querySearch = filters.search.trim() ? settledSearch : '';
  // ⚠️ 기다리는 동안은 '읽는 중' 이다 — 목록·개수가 아직 옛 검색어 것이라, 그 개수로 판단하는
  //    폴더 담기(usePaperBulkAdd 의 folderEnabled)가 그 틈에 눌리면 안 된다
  const searchPending = querySearch.trim() !== filters.search.trim();

  const queryKey = JSON.stringify(toProblemQuery({ ...filters, search: querySearch }));
  // 세대를 키에 접어 넣는다 — 조건이 그대로여도 reload() 하면 다시 읽는다
  const fetchKey = `${reloadSeq}:${queryKey}`;
  const loading = loadedKey !== fetchKey || searchPending;

  useEffect(() => {
    // 검색어를 치는 중이면 묻지 않는다 — 쪽 번호(page: 0)만 먼저 바뀌어 옛 검색어로 한 번 더 묻게 된다
    if (searchPending) return undefined;
    let alive = true;
    fetchProblemPage(JSON.parse(queryKey))
      .then((page) => {
        if (!alive) return;
        setRows(page.rows);
        setTotal(page.total);
      })
      .catch((e) => {
        if (alive) toast.error(e instanceof Error ? e.message : '불러오지 못했어요.');
      })
      .finally(() => {
        if (alive) setLoadedKey(fetchKey);
      });
    return () => {
      alive = false;
    };
  }, [queryKey, fetchKey, searchPending]);

  const patch = useCallback((next: Partial<ProblemFilters>) => {
    setFilters((f) => ({ ...f, ...next }));
  }, []);

  const reset = useCallback(() => setFilters(EMPTY_FILTERS), []);

  /** 조건은 그대로 두고 목록만 다시 읽는다 (선택 삭제 뒤) */
  const reload = useCallback(() => setReloadSeq((n) => n + 1), []);

  const pageCount = Math.max(1, Math.ceil(total / PROBLEM_PAGE_SIZE));

  return {
    filters, rows, total, loading, facets, areaFacets, unitFacets, grammarCounts, workFacets,
    pageCount, patch, reset, reload,
  };
}
