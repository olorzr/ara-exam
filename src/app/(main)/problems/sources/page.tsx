'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fetchSources, SOURCE_PAGE_SIZE } from '@/lib/problem-bank/queries';
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

  useEffect(() => {
    let alive = true;
    fetchSources()
      .then((page) => {
        if (!alive) return;
        setSources(page.rows);
        setTotal(page.total);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : '불러오지 못했어요.'))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  /** 목록은 끊어 온다 — 상한만 걸면 옛 출처가 조용히 사라진다 */
  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const next = await fetchSources({ page: Math.floor(sources.length / SOURCE_PAGE_SIZE) });
      setSources((list) => [...list, ...next.rows]);
      setTotal(next.total);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '더 불러오지 못했어요.');
    } finally {
      setLoadingMore(false);
    }
  };

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
          {sources.map((source) => (
            <Link
              key={source.id}
              href={`/problems/sources/${source.id}`}
              className="block rounded-lg border border-gray-200 p-4 transition hover:border-primary"
            >
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
          ))}

          {sources.length < total && (
            <div className="flex justify-center pt-2">
              <Button type="button" variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? '불러오는 중…' : `더 보기 (${sources.length} / ${total})`}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
