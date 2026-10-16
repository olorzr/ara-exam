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
 * 검색은 문항 3만 행을 훑는 조회라(sql/66 — RLS 때문에 인덱스를 못 쓴다. 작품·문법 축만 sql/72 함수에서
 * GIN 을 탄다) 글자마다 보내면 앞 조회가 끝나기 전에 다음 조회가 쌓인다.
 */
export const ARCHIVE_SEARCH_DEBOUNCE_MS = 300;

export type ArchiveRow = Problem & { source: ProblemSource };

/**
 * 지금 조건의 목록을 못 읽은 까닭.
 * - `refresh`: **같은 조건**을 다시 읽다 실패했다(지운 뒤·다시 시도). 옛 목록이 이미 틀렸을 수 있다
 * - `query`: **바뀐 조건**(학년·작품·문법·쪽·검색)을 읽다 실패했다
 */
export type ArchiveFailure = 'refresh' | 'query';

/** 마지막으로 **성공한** 조회 — 어느 조건의 결과인지 함께 든다 */
interface ArchivePageResult {
  /** 세대까지 접은 열쇠 — 지금 화면이 바라는 결과인지 이것으로 가린다 */
  fetchKey: string;
  rows: ArchiveRow[];
  total: number;
}

/** 지금 조건의 결과가 없을 때 내주는 목록 — 렌더마다 새 배열을 만들지 않는다 */
const NO_ROWS: ArchiveRow[] = [];

/**
 * 아카이브 목록 상태.
 *
 * 목록은 **반드시 페이지를 나눈다** — PostgREST 는 기본 1,000행에서 조용히 잘려서
 * "전부 봤다"고 착각하기 쉽다.
 * @param initial - 첫 필터 (주소에서 복원한 값)
 */
export function useProblemArchive(initial: ProblemFilters = EMPTY_FILTERS) {
  const [filters, setFilters] = useState<ProblemFilters>(initial);
  /**
   * 목록과 개수는 **그 결과를 만든 조건과 한 덩어리**로 든다(2026-10-15 리뷰 5번).
   *
   * ⚠️ 예전에는 `rows`/`total` 을 따로 두고 실패해도 `loadedKey` 를 새 조건으로 적어서, 새 조건이
   *    실패하면 **옛 조건의 행·개수가 새 조건의 정상 결과처럼** 보였고 선택·담기·삭제·태깅에도
   *    그대로 넘어갔다. 이제 지금 조건의 성공 결과가 없으면 행은 비고 `failed` 가 그 까닭을 말한다.
   *    로딩은 여전히 "어느 조건의 결과를 들고 있는가" 에서 **파생**한다(`set-state-in-effect`).
   */
  const [result, setResult] = useState<ArchivePageResult | null>(null);
  /** 실패한 조회의 열쇠 — 지금 열쇠와 같을 때만 '실패' 다(늦게 온 옛 실패는 효과 정리가 버린다) */
  const [failedKey, setFailedKey] = useState<string | null>(null);
  /** 마지막으로 성공한 **조건** — 실패가 같은 조건의 재조회(`refresh`)인지 가른다 */
  const [lastOkQueryKey, setLastOkQueryKey] = useState<string | null>(null);
  /** 조건이 같아도 다시 읽게 하는 세대 번호 (지운 뒤 목록 갱신) */
  const [reloadSeq, setReloadSeq] = useState(0);
  /** 실패한 조회를 다시 묻는 세대 — 패싯은 다시 읽지 않는다(그건 `reloadSeq` 의 일이다) */
  const [retrySeq, setRetrySeq] = useState(0);
  const [facets, setFacets] = useState<SourceFacets>(EMPTY_SOURCE_FACETS);
  const [areaFacets, setAreaFacets] = useState<string[][]>([]);
  const [unitFacets, setUnitFacets] = useState<string[][]>([]);
  /** 문법 분류는 원소가 경로 문자열이고 문항 수를 함께 들고 있어 다른 패싯과 모양이 다르다 */
  const [grammarFacets, setGrammarFacets] = useState<GrammarFacet[]>([]);
  const [workFacets, setWorkFacets] = useState<WorkFacet[]>([]);

  // 다섯 패싯은 RPC 한 번(sql/66 → 서버 캐시 sql/71)을 나눠 쓴다 — 캐시(facets-cache.ts)가 한 요청만 보낸다.
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
  // 세대를 키에 접어 넣는다 — 조건이 그대로여도 reload()·retry() 하면 다시 읽는다
  const fetchKey = `${reloadSeq}.${retrySeq}:${queryKey}`;
  /** 지금 조건의 성공 결과 — 없으면 null(읽는 중이거나 실패) */
  const current = result?.fetchKey === fetchKey ? result : null;
  const failed: ArchiveFailure | null = current || searchPending || failedKey !== fetchKey
    ? null
    : (lastOkQueryKey === queryKey ? 'refresh' : 'query');
  const loading = (!current && !failed) || searchPending;
  const rows = current?.rows ?? NO_ROWS;
  const total = current?.total ?? 0;

  useEffect(() => {
    // 검색어를 치는 중이면 묻지 않는다 — 쪽 번호(page: 0)만 먼저 바뀌어 옛 검색어로 한 번 더 묻게 된다
    if (searchPending) return undefined;
    // ⚠️ 정리된 효과(조건이 또 바뀌었다)의 성공·실패는 **둘 다** 버린다 — 늦은 실패가 최신 목록을
    //    '실패' 로 덮거나, 늦은 성공이 다른 조건의 행을 들이면 안 된다
    let alive = true;
    fetchProblemPage(JSON.parse(queryKey))
      .then((page) => {
        if (!alive) return;
        setResult({ fetchKey, rows: page.rows, total: page.total });
        setLastOkQueryKey(queryKey);
        setFailedKey(null);
      })
      .catch((e) => {
        if (!alive) return;
        setFailedKey(fetchKey);
        toast.error(e instanceof Error ? e.message : '불러오지 못했어요.');
      });
    return () => {
      alive = false;
      // 이 조건을 떠나면 그 결과·실패를 **둘 다** 접는다(코덱스 1R). 결과를 남겨 두면 같은 조건으로
      // 돌아왔을 때 옛 행이 곧바로 '지금 조건의 결과' 가 되고, 다시 읽기가 실패해도 그 행이 남는다.
      // 실패를 남겨 두면 다시 읽는 동안 옛 실패가 뜬다
      setResult((prev) => (prev?.fetchKey === fetchKey ? null : prev));
      setFailedKey((key) => (key === fetchKey ? null : key));
    };
  }, [queryKey, fetchKey, searchPending]);

  const patch = useCallback((next: Partial<ProblemFilters>) => {
    setFilters((f) => ({ ...f, ...next }));
  }, []);

  const reset = useCallback(() => setFilters(EMPTY_FILTERS), []);

  /** 조건은 그대로 두고 목록만 다시 읽는다 (선택 삭제 뒤) */
  const reload = useCallback(() => setReloadSeq((n) => n + 1), []);

  /** 실패한 목록 조회만 다시 묻는다 */
  const retry = useCallback(() => setRetrySeq((n) => n + 1), []);

  const pageCount = Math.max(1, Math.ceil(total / PROBLEM_PAGE_SIZE));

  return {
    filters, rows, total, loading, failed, facets, areaFacets, unitFacets, grammarCounts, workFacets,
    pageCount, patch, reset, reload, retry,
  };
}
