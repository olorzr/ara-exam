'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import ArchiveSelectionBar from '@/components/problem-bank/ArchiveSelectionBar';
import ArchiveSidePanel from '@/components/problem-bank/ArchiveSidePanel';
import ProblemCard from '@/components/problem-bank/ProblemCard';
import ProblemFilterBar from '@/components/problem-bank/ProblemFilterBar';
import { useArchiveSelection } from '@/hooks/useArchiveSelection';
import { useProblemArchive, type ArchiveRow } from '@/hooks/useProblemArchive';
import { useSignedImageUrls } from '@/hooks/useSignedImageUrls';
import { filtersFromParams, filtersToQueryString, type ProblemFilters } from '@/lib/problem-bank/filters';
import { countPapersUsing, deleteProblems } from '@/lib/problem-bank/mutations';
import { PROBLEM_PAGE_SIZE } from '@/lib/problem-bank/queries';
import { bulkDeleteConfirmMessage, pageAfterDelete } from '@/lib/problem-bank/selection';

/**
 * 불러오는 중일 때 선택에 넘길 목록.
 *
 * ⚠️ 렌더마다 `[]` 를 새로 만들면 훅의 메모가 매번 깨진다 — 상수 하나를 재사용한다.
 */
const NO_ROWS: ArchiveRow[] = [];

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
  /**
   * ⚠️ 불러오는 중에는 **보이는 행이 없다**(화면은 스피너다). 옛 쪽의 행을 그대로 넘기면
   *    '전체 선택 → 삭제' 가 **화면에 없는 이전 쪽 문항을 지운다**(코덱스 리뷰 P1).
   */
  const selection = useArchiveSelection(archive.loading ? NO_ROWS : archive.rows);
  const [deleting, setDeleting] = useState(false);
  /**
   * 세대 둘. 지우는 동안 무엇이 바뀌었는지에 따라 할 일이 다르기 때문이다
   * (usePdfPages 의 genRef 와 같은 규약).
   *
   * · `viewSeq` — **조건·쪽**이 바뀌면 올라간다. 삭제 뒤 쪽 보정은 지울 때의 쪽·전체 개수를
   *   쓰므로, 조건이 바뀌었으면 그 계산을 새 조건에 얹으면 안 된다.
   * · `targetSeq` — 거기에 **선택**까지 포함한다. 확인창 앞에 문제지 수를 묻는 왕복이 있어,
   *   그 틈에 체크를 바꾸면 확인창의 개수와 실제로 지울 문항이 어긋난다.
   */
  const viewSeq = useRef(0);
  const targetSeq = useRef(0);
  /**
   * 화면이 아직 붙어 있는가 — 물어보는 사이에 다른 메뉴로 떠나면 확인창을 띄우지 않는다.
   *
   * ⚠️ 마운트할 때 **반드시 다시 true 로 되돌린다.** 개발 모드(StrictMode)는 마운트 →
   *    언마운트 → 재마운트를 하는데, 정리에서 false 로만 두면 재마운트 뒤에도 false 로
   *    남아 **선택 삭제가 통째로 먹통이 된다**(usePdfPages 와 같은 규약).
   */
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  // 필터가 바뀌면 주소도 따라간다(뒤로 가기로 히스토리를 채우지 않도록 replace)
  useEffect(() => {
    router.replace(`/problems/archive${filtersToQueryString(archive.filters)}`, { scroll: false });
  }, [archive.filters, router]);

  const thumbnails = useSignedImageUrls(
    archive.rows.map((r) => r.image_path).filter(Boolean),
  );

  /**
   * 조건이 바뀌면 선택을 비운다.
   *
   * ⚠️ 화면에서 조건을 바꾸는 길은 **전부 이 함수**를 지나야 한다. 선택을 남기면
   *    다른 쪽·다른 조건의 문항이 선택된 채로 남아, 지울 때 화면에 보이지 않는 것이
   *    함께 사라질 수 있다(삭제 대상은 한 번 더 걸러내지만 개수 표시가 거짓이 된다).
   */
  const patch = useCallback((next: Partial<ProblemFilters>) => {
    viewSeq.current += 1;
    targetSeq.current += 1;
    selection.clear();
    archive.patch(next);
  }, [selection, archive]);

  const reset = useCallback(() => {
    viewSeq.current += 1;
    targetSeq.current += 1;
    selection.clear();
    archive.reset();
  }, [selection, archive]);

  const toggleOne = useCallback((id: string) => {
    targetSeq.current += 1;
    selection.toggle(id);
  }, [selection]);

  const toggleAll = useCallback(() => {
    targetSeq.current += 1;
    selection.toggleAll();
  }, [selection]);

  const handleBulkDelete = async () => {
    const ids = selection.selectedVisible;
    if (ids.length === 0) return;

    const view = viewSeq.current;
    const target = targetSeq.current;
    setDeleting(true);
    try {
      const papers = await countPapersUsing(ids);
      // 묻는 사이에 화면을 떠났으면 조용히 그만둔다
      if (!aliveRef.current) return;
      // 지울 대상이 바뀌었으면 지우지 않는다 — 확인창의 개수가 거짓이 된다.
      // 조용히 끝내면 "왜 안 지워지지" 가 되므로 다시 누르라고 알린다
      if (target !== targetSeq.current) {
        toast.info('선택이 바뀌어 삭제를 멈췄어요. 다시 눌러 주세요.');
        return;
      }
      if (!window.confirm(bulkDeleteConfirmMessage(ids.length, papers))) return;

      await deleteProblems(ids);
      toast.success(`${ids.length}개 문항을 지웠어요.`);
      selection.exit();

      if (!aliveRef.current) return;

      // ⚠️ 여기서 보는 것은 **조건**의 세대다(선택이 아니다). 지우는 사이 체크를 바꿨을 뿐이면
      //    쪽·전체 개수는 그대로라 보정이 여전히 옳다 — 선택으로 막으면 마지막 쪽을 비우고도
      //    빈 쪽에 남는다(코덱스 리뷰 4R). 조건이 바뀌었을 때만 보정을 접고,
      //    그 경우에도 **목록은 반드시 다시 읽는다**(안 그러면 지운 문항이 남아 보인다).
      if (view !== viewSeq.current) {
        archive.reload();
        return;
      }

      // 마지막 쪽을 통째로 지웠으면 앞 쪽으로 — 빈 목록만 남으면 뭘 봤는지 알 수 없다
      const next = pageAfterDelete({
        page: archive.filters.page,
        pageSize: PROBLEM_PAGE_SIZE,
        total: archive.total,
        deleted: ids.length,
      });
      if (next !== archive.filters.page) archive.patch({ page: next });
      else archive.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '지우지 못했어요.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🗂️ 문제 아카이브</h1>
          <p className="mt-1 text-sm text-gray-500">
            읽어 둔 기출 문항입니다. 왼쪽에서 교과서 단원이나 학교 기출을 고르거나 조건으로 찾아 새 문제지를 만들 수 있어요.
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

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-4 lg:self-start">
          <ArchiveSidePanel
            filters={archive.filters}
            schoolExams={archive.facets.schoolExams}
            onChange={patch}
          />
        </div>

        <div className="space-y-4">
          <ProblemFilterBar
            filters={archive.filters}
            facets={archive.facets}
            areaFacets={archive.areaFacets}
            unitFacets={archive.unitFacets}
            total={archive.total}
            onChange={patch}
            onReset={reset}
          />

          <ArchiveSelectionBar
            selectMode={selection.selectMode}
            count={selection.count}
            isAllSelected={selection.isAllSelected}
            disabled={archive.loading || archive.rows.length === 0}
            busy={deleting}
            onEnter={selection.enter}
            onExit={selection.exit}
            onToggleAll={toggleAll}
            onDelete={handleBulkDelete}
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
                  thumbnailUrl={thumbnails.urls.get(row.image_path) ?? null}
                  selectMode={selection.selectMode}
                  selected={selection.isSelected(row.id)}
                  onToggleSelect={() => toggleOne(row.id)}
                />
              ))}
            </div>
          )}

          {archive.pageCount > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                type="button" variant="outline" size="sm"
                onClick={() => patch({ page: archive.filters.page - 1 })}
                disabled={archive.filters.page <= 0}
              >
                이전
              </Button>
              <span className="text-sm text-gray-500">
                {archive.filters.page + 1} / {archive.pageCount}
              </span>
              <Button
                type="button" variant="outline" size="sm"
                onClick={() => patch({ page: archive.filters.page + 1 })}
                disabled={archive.filters.page >= archive.pageCount - 1}
              >
                다음
              </Button>
            </div>
          )}
        </div>
      </div>
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
