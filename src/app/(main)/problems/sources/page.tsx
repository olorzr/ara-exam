'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import SourceFilterBar from '@/components/problem-bank/SourceFilterBar';
import SourceTable from '@/components/problem-bank/SourceTable';
import { useSourceDelete } from '@/hooks/useSourceDelete';
import { useSourceList } from '@/hooks/useSourceList';
import { EMPTY_SOURCE_FACETS, fetchSourceFacets, type SourceFacets } from '@/lib/problem-bank/facets';
import {
  EMPTY_SOURCE_LIST_FILTERS, hasActiveSourceFilters, sourceListFiltersFromParams,
  sourceListFiltersToQueryString, toSourceListQuery, type SourceListFilters,
} from '@/lib/problem-bank/source-list-filters';

/** 제목을 치는 동안 글자마다 묻지 않도록 잠깐 기다린다 */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * 올라간 기출 목록 (`/problems/sources`).
 *
 * 기출은 원장님이 적재 스크립트로 올린다 — 앱의 업로드 화면과 검수 절차는 2026-09-30 에 걷었다.
 * 여기는 올라간 시험지를 **한눈에 보고 드롭다운으로 좁혀 찾는** 자리이고, 제목을 누르면
 * 원본과 나란히 보며 고치는 시험지 화면으로 간다.
 *
 * 조건은 주소에 싣는다 — 시험지를 열었다가 뒤로 와도 좁혀 둔 목록이 그대로다.
 */
function SourcesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<SourceListFilters>(
    () => sourceListFiltersFromParams(new URLSearchParams(searchParams.toString())),
  );
  const [title, setTitle] = useState(filters.title);
  const [facets, setFacets] = useState<SourceFacets>(EMPTY_SOURCE_FACETS);

  // 주소는 조건을 따라간다(뒤로 가기에 히스토리를 쌓지 않도록 replace)
  useEffect(() => {
    router.replace(`/problems/sources${sourceListFiltersToQueryString(filters)}`, { scroll: false });
  }, [filters, router]);

  // 제목은 치기를 멈춘 뒤에 묻는다
  useEffect(() => {
    const timer = setTimeout(() => setTitle(filters.title), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filters.title]);

  useEffect(() => {
    let alive = true;
    // 선택지를 못 읽어도 목록은 봐야 한다 — 칸이 '전체' 만 든 채로 남는다
    fetchSourceFacets()
      .then((next) => { if (alive) setFacets(next); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);

  const query = useMemo(() => toSourceListQuery({ ...filters, title }), [filters, title]);
  const list = useSourceList(query);
  const { deletingId, requestDelete } = useSourceDelete(list.afterDelete);

  const patch = (next: Partial<SourceListFilters>) => setFilters((prev) => ({ ...prev, ...next }));
  const reset = () => setFilters((prev) => ({ ...EMPTY_SOURCE_LIST_FILTERS, sort: prev.sort }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">📚 올라간 기출</h1>
        <p className="mt-1 text-sm text-gray-500">
          올라간 기출 시험지입니다. 제목을 누르면 원본과 나란히 보며 틀린 곳을 고칠 수 있어요.
        </p>
      </div>

      <SourceFilterBar
        filters={filters}
        facets={facets}
        total={list.total}
        onChange={patch}
        onReset={reset}
      />

      {list.initialLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : list.rows.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 py-12 text-center text-sm text-gray-500">
            <p>{hasActiveSourceFilters(filters) ? '조건에 맞는 시험지가 없어요.' : '아직 올라간 기출이 없어요.'}</p>
            {hasActiveSourceFilters(filters) && (
              <Button type="button" variant="outline" size="sm" onClick={reset}>조건 지우기</Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <SourceTable
            rows={list.rows}
            refreshing={list.refreshing}
            deleting={deletingId !== null}
            onDelete={requestDelete}
          />

          {/*
            다시 읽기에 실패했으면 '더 보기' 대신 다시 읽기만 내준다 — 어긋난 목록에
            이어 받으면 경계에 걸린 행이 조용히 빠진다
          */}
          {list.needsResync ? (
            <div className="flex flex-col items-center gap-1">
              <p className="text-xs text-amber-700">
                지운 뒤 목록을 다시 읽지 못했어요. 아래 단추로 다시 읽어 주세요.
              </p>
              <Button type="button" variant="outline" onClick={list.syncLoaded}>
                목록 다시 읽기
              </Button>
            </div>
          ) : list.rows.length < list.total ? (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={list.loadMore}
                disabled={list.loadingMore || list.refreshing || deletingId !== null}
              >
                {list.loadingMore ? '불러오는 중…' : `더 보기 (${list.rows.length} / ${list.total})`}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** useSearchParams 는 Suspense 경계가 필요하다(Next 규약) */
export default function ProblemSourcesPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-gray-500">불러오는 중…</div>}>
      <SourcesContent />
    </Suspense>
  );
}
