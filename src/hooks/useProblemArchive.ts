'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  EMPTY_FILTERS, toProblemQuery, type ProblemFilters,
} from '@/lib/problem-bank/filters';
import {
  EMPTY_SOURCE_FACETS, fetchAreaFacets, fetchSourceFacets, fetchUnitFacets,
  type SourceFacets,
} from '@/lib/problem-bank/facets';
import { fetchProblemPage, PROBLEM_PAGE_SIZE } from '@/lib/problem-bank/queries';
import type { Problem, ProblemSource } from '@/types/problem-bank';

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

  useEffect(() => {
    fetchSourceFacets().then(setFacets).catch(() => { /* 선택지가 없어도 목록은 본다 */ });
    fetchAreaFacets().then(setAreaFacets).catch(() => { /* 영역 필터만 빠진다 */ });
    fetchUnitFacets().then(setUnitFacets).catch(() => { /* 단원 필터만 빠진다 */ });
  }, []);

  const queryKey = JSON.stringify(toProblemQuery(filters));
  // 세대를 키에 접어 넣는다 — 조건이 그대로여도 reload() 하면 다시 읽는다
  const fetchKey = `${reloadSeq}:${queryKey}`;
  const loading = loadedKey !== fetchKey;

  useEffect(() => {
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
  }, [queryKey, fetchKey]);

  const patch = useCallback((next: Partial<ProblemFilters>) => {
    setFilters((f) => ({ ...f, ...next }));
  }, []);

  const reset = useCallback(() => setFilters(EMPTY_FILTERS), []);

  /** 조건은 그대로 두고 목록만 다시 읽는다 (선택 삭제 뒤) */
  const reload = useCallback(() => setReloadSeq((n) => n + 1), []);

  const pageCount = Math.max(1, Math.ceil(total / PROBLEM_PAGE_SIZE));

  return {
    filters, rows, total, loading, facets, areaFacets, unitFacets, pageCount,
    patch, reset, reload,
  };
}
