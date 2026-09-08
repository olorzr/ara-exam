'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import ProblemCard from '@/components/problem-bank/ProblemCard';
import ProblemFilterBar from '@/components/problem-bank/ProblemFilterBar';
import { useProblemArchive } from '@/hooks/useProblemArchive';
import { useSignedImageUrls } from '@/hooks/useSignedImageUrls';
import { filtersFromParams, filtersToQueryString } from '@/lib/problem-bank/filters';

/**
 * 기출 문제 아카이브 (`/problems/archive`).
 *
 * 필터는 주소에 실린다 — 검수하러 갔다 돌아와도 조건이 남고 링크를 주고받을 수 있다.
 */
function ArchiveContent() {
  const router = useRouter();
  const params = useSearchParams();
  // 주소는 **처음 한 번만** 읽는다. 이후 주소는 필터를 따라가므로 다시 읽으면 되돌아간다.
  // useMemo 가 아니라 useState 초기화를 쓰는 이유: '처음 값'이라는 뜻이 명확하고,
  // 메모는 언제든 다시 계산될 수 있다는 계약이라 여기 쓰면 안 된다.
  const [initial] = useState(() => filtersFromParams(new URLSearchParams(params.toString())));
  const archive = useProblemArchive(initial);

  // 필터가 바뀌면 주소도 따라간다(뒤로 가기로 히스토리를 채우지 않도록 replace)
  useEffect(() => {
    router.replace(`/problems/archive${filtersToQueryString(archive.filters)}`, { scroll: false });
  }, [archive.filters, router]);

  const thumbnails = useSignedImageUrls(
    archive.rows.map((r) => r.image_path).filter(Boolean),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🗂️ 문제 아카이브</h1>
          <p className="mt-1 text-sm text-gray-500">
            읽어 둔 기출 문항입니다. 골라서 새 문제지를 만들 수 있어요.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/problems/upload"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
          >
            기출 업로드
          </Link>
          <Link
            href="/problems/papers/new"
            className="rounded-md bg-primary px-3 py-2 text-sm text-white"
          >
            + 문제지 만들기
          </Link>
        </div>
      </div>

      <ProblemFilterBar
        filters={archive.filters}
        facets={archive.facets}
        areaFacets={archive.areaFacets}
        total={archive.total}
        onChange={archive.patch}
        onReset={archive.reset}
      />

      {archive.loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : archive.rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-gray-500">
            조건에 맞는 문항이 없어요.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {archive.rows.map((row) => (
            <ProblemCard
              key={row.id}
              problem={row}
              thumbnailUrl={thumbnails.get(row.image_path) ?? null}
            />
          ))}
        </div>
      )}

      {archive.pageCount > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            type="button" variant="outline" size="sm"
            onClick={() => archive.patch({ page: archive.filters.page - 1 })}
            disabled={archive.filters.page <= 0}
          >
            이전
          </Button>
          <span className="text-sm text-gray-500">
            {archive.filters.page + 1} / {archive.pageCount}
          </span>
          <Button
            type="button" variant="outline" size="sm"
            onClick={() => archive.patch({ page: archive.filters.page + 1 })}
            disabled={archive.filters.page >= archive.pageCount - 1}
          >
            다음
          </Button>
        </div>
      )}
    </div>
  );
}

/** useSearchParams 는 Suspense 경계가 필요하다(Next 규약) */
export default function ProblemArchivePage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-gray-500">불러오는 중…</div>}>
      <ArchiveContent />
    </Suspense>
  );
}
