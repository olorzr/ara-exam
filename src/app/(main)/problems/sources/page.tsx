'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSourceDelete } from '@/hooks/useSourceDelete';
import { fetchSources, refetchSources } from '@/lib/problem-bank/source-list';
import { sourceLabel } from '@/lib/problem-bank/source-label';
import type { ProblemSource, ProblemSourceStatus } from '@/types/problem-bank';

/** 상태별 배지 색 */
const STATUS_STYLE: Record<ProblemSourceStatus, string> = {
  업로드: 'bg-gray-200 text-gray-700',
  추출중: 'bg-sky-500 text-white',
  검수중: 'bg-amber-500 text-white',
  완료: 'bg-emerald-500 text-white',
};

/**
 * 업로드한 출처 목록 (`/problems/sources`).
 * 검수는 여기서 들어간다.
 */
export default function ProblemSourcesPage() {
  const [sources, setSources] = useState<ProblemSource[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  /**
   * 다시 읽어야 하는 상태 — 지운 뒤 목록 재조회가 실패했다.
   *
   * 이때 '더 보기' 를 그대로 두면 안 된다. 지운 행만큼 뒤쪽 offset 이 당겨져 있어서
   * 이어 받으면 **경계에 걸린 행이 빠진다**. 성공할 때까지 다시 읽기만 내준다.
   */
  const [needsResync, setNeedsResync] = useState(false);
  /**
   * 지금까지 펼친 쪽 수.
   *
   * ⚠️ state 가 아니라 ref 다. 확인창을 띄운 사이에 '더 보기' 가 끝나면 삭제가 붙들고
   *    있던 옛 값으로 다시 읽어 **뒤쪽 한 쪽이 통째로 사라진다** — 요청하는 순간의 값을
   *    읽어야 한다.
   * ⚠️ `sources.length` 로 역산하지도 않는다(예전 방식). 한 행을 지우면 30→29 가 되어
   *    '더 보기' 가 0쪽을 다시 불러 **중복 행**을 만든다.
   */
  const loadedPagesRef = useRef(1);
  /**
   * 목록 요청 세대 — 늦게 온 응답이 새 응답을 덮어쓰지 않게 한다.
   *
   * 삭제 뒤 재조회와 '더 보기' 가 겹칠 수 있고, 둘이 뒤섞이면 목록과 `loadedPages` 가
   * 어긋나 그때부터 쪽이 통째로 건너뛰어진다(코덱스 리뷰 P1).
   */
  const reqSeq = useRef(0);

  useEffect(() => {
    let alive = true;
    const seq = ++reqSeq.current;
    fetchSources()
      .then((page) => {
        if (!alive || seq !== reqSeq.current) return;
        setSources(page.rows);
        setTotal(page.total);
        loadedPagesRef.current = 1;
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : '불러오지 못했어요.'))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  /** 목록은 끊어 온다 — 상한만 걸면 옛 출처가 조용히 사라진다 */
  const loadMore = async () => {
    if (loadingMore || needsResync) return;
    const seq = ++reqSeq.current;
    setLoadingMore(true);
    try {
      const next = await fetchSources({ page: loadedPagesRef.current });
      // 그 사이 삭제·재조회가 끼어들었으면 이 응답은 버린다(쪽 수도 올리지 않는다)
      if (seq !== reqSeq.current) return;
      setSources((list) => [...list, ...next.rows]);
      setTotal(next.total);
      loadedPagesRef.current += 1;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '더 불러오지 못했어요.');
    } finally {
      setLoadingMore(false);
    }
  };

  /**
   * 펼쳐 둔 만큼을 **0쪽부터 통째로** 다시 읽는다.
   *
   * 지운 뒤에 지역 목록에서 행만 빼면 안 된다 — 한 행이 사라지면 DB 쪽 offset 이 하나씩
   * 당겨져 이어 받을 때 **경계에 걸린 행이 영영 안 보인다**(중복보다 나쁘다. 선생님은 그
   * 출처가 지워진 줄 안다). 펼친 쪽 수는 그대로 두어 보던 만큼이 다시 채워지게 한다 —
   * 목록이 갑자기 접히면 하던 정리를 놓친다.
   */
  const syncLoaded = useCallback(async () => {
    const seq = ++reqSeq.current;
    try {
      const page = await refetchSources(loadedPagesRef.current);
      if (seq !== reqSeq.current) return;
      setSources(page.rows);
      setTotal(page.total);
      setNeedsResync(false);
    } catch (e) {
      if (seq !== reqSeq.current) return;
      // 실패를 삼키면 안 된다 — 목록은 지운 행만큼 어긋나 있고 그대로 이어 받으면
      // 행이 빠진다. 다시 읽을 때까지 '더 보기' 를 닫는다
      setNeedsResync(true);
      toast.error(e instanceof Error ? e.message : '목록을 다시 읽지 못했어요.');
    }
  }, []);

  const { deletingId, requestDelete } = useSourceDelete(useCallback(
    async (deletedId: string) => {
      // 다시 읽는 동안 사라진 행이 남아 있으면 "왜 안 지워졌지" 가 되므로 먼저 걷어낸다
      setSources((list) => list.filter((s) => s.id !== deletedId));
      await syncLoaded();
    },
    [syncLoaded],
  ));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📄 출처 · 검수</h1>
          <p className="mt-1 text-sm text-gray-500">
            올린 기출 PDF 와 읽기 상태입니다. 검수를 마치면 아카이브에서 문제지에 담을 수 있어요.
          </p>
        </div>
        <Link
          href="/problems/upload"
          className="shrink-0 rounded-md bg-primary px-3 py-2 text-sm text-white"
        >
          + 기출 업로드
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : sources.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-gray-500">
            아직 올린 기출이 없어요.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {/*
            행을 통째로 <Link> 로 감싸지 않는다 — 그 안에 버튼을 넣으면 잘못된 HTML 이고
            키보드로도 못 쓴다. 문제지 목록(papers/page.tsx)과 같은 모양으로 나눈다.
          */}
          {sources.map((source) => (
            <div
              key={source.id}
              className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 transition hover:border-primary"
            >
              <Link href={`/problems/sources/${source.id}`} className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-gray-900">{source.title}</span>
                  <Badge className={STATUS_STYLE[source.status]}>{source.status}</Badge>
                  <Badge variant="outline">{source.source_type}</Badge>
                  <span className="text-sm text-gray-500">{sourceLabel(source)}</span>
                  <span className="ml-auto text-xs text-gray-400">
                    {source.page_count}쪽 · {new Date(source.created_at).toLocaleDateString('ko-KR')}
                  </span>
                </div>
                {(source.ocr_meta?.warnings?.length ?? 0) > 0 && (
                  <p className="mt-1 text-xs text-amber-700">
                    확인이 필요한 항목 {source.ocr_meta.warnings!.length}건
                  </p>
                )}
              </Link>
              <button
                type="button"
                onClick={() => requestDelete(source)}
                disabled={deletingId !== null}
                className="shrink-0 rounded p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                aria-label={`${source.title} 지우기`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          {/*
            다시 읽기에 실패했으면 '더 보기' 대신 다시 읽기만 내준다 — 어긋난 목록에
            이어 받으면 경계에 걸린 행이 조용히 빠진다
          */}
          {needsResync ? (
            <div className="flex flex-col items-center gap-1 pt-2">
              <p className="text-xs text-amber-700">
                지운 뒤 목록을 다시 읽지 못했어요. 아래 단추로 다시 읽어 주세요.
              </p>
              <Button type="button" variant="outline" onClick={syncLoaded}>
                목록 다시 읽기
              </Button>
            </div>
          ) : sources.length < total ? (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={loadMore}
                disabled={loadingMore || deletingId !== null}
              >
                {loadingMore ? '불러오는 중…' : `더 보기 (${sources.length} / ${total})`}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
