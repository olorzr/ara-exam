'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import ArchiveSelectionBar from '@/components/problem-bank/ArchiveSelectionBar';
import ArchiveSidePanel from '@/components/problem-bank/ArchiveSidePanel';
import ArchiveList from '@/components/problem-bank/ArchiveList';
import ArchivePager from '@/components/problem-bank/ArchivePager';
import ProblemCard from '@/components/problem-bank/ProblemCard';
import ProblemDetailDialog from '@/components/problem-bank/ProblemDetailDialog';
import ProblemFilterBar from '@/components/problem-bank/ProblemFilterBar';
import GrammarBulkTagDialog from '@/components/problem-bank/GrammarBulkTagDialog';
import { useArchiveBulkActions } from '@/hooks/useArchiveBulkActions';
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
  /** 선택·삭제·문법 태깅 — 세대 번호와 생존 표시가 맞물려 있어 한 훅에 모여 있다 */
  const bulk = useArchiveBulkActions(archive);
  const { selection, patch, reset } = bulk;
  /** 일괄 문법 태깅 창 */
  const [tagOpen, setTagOpen] = useState(false);
  /** 상세 창에 띄운 문항 — 목록의 조건·스크롤·선택을 잃지 않으려고 창으로 연다 */
  const [openId, setOpenId] = useState<string | null>(null);

  // 필터가 바뀌면 주소도 따라간다(뒤로 가기로 히스토리를 채우지 않도록 replace)
  useEffect(() => {
    router.replace(`/problems/archive${filtersToQueryString(archive.filters)}`, { scroll: false });
  }, [archive.filters, router]);

  const thumbnails = useSignedImageUrls(
    archive.rows.map((r) => r.image_path).filter(Boolean),
  );

  const handleApplyGrammar = async (path: string[]) => {
    if (await bulk.applyGrammar(path)) setTagOpen(false);
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
            works={archive.workFacets}
            grammarCounts={archive.grammarCounts}
            onChange={patch}
          />
        </div>

        <div className="space-y-4">
          <ProblemFilterBar
            filters={archive.filters}
            facets={archive.facets}
            areaFacets={archive.areaFacets}
            unitFacets={archive.unitFacets}
            workFacets={archive.workFacets}
            total={archive.total}
            onChange={patch}
            onReset={reset}
          />

          <ArchiveSelectionBar
            selectMode={selection.selectMode}
            count={selection.count}
            isAllSelected={selection.isAllSelected}
            disabled={archive.loading || archive.rows.length === 0}
            busy={bulk.deleting || bulk.tagging}
            onEnter={selection.enter}
            onExit={selection.exit}
            onToggleAll={bulk.toggleAll}
            onDelete={bulk.bulkDelete}
            onTagGrammar={() => setTagOpen(true)}
          />

          <ArchiveList
            rows={archive.rows}
            loading={archive.loading}
            // 작품을 고른 동안에는 묶음 안에서 '함께 묻는 문항' 까지 갈라 세운다
            workTitle={archive.filters.work_title}
            renderCard={(row) => (
              <ProblemCard
                key={row.id}
                problem={row}
                thumbnailUrl={thumbnails.urls.get(row.image_path) ?? null}
                selectMode={selection.selectMode}
                selected={selection.isSelected(row.id)}
                onToggleSelect={() => bulk.toggleOne(row.id)}
                onOpen={() => setOpenId(row.id)}
              />
            )}
          />

          <ArchivePager
            page={archive.filters.page}
            pageCount={archive.pageCount}
            onPage={(page) => patch({ page })}
          />
        </div>
      </div>

      <ProblemDetailDialog problemId={openId} onClose={() => setOpenId(null)} />

      <GrammarBulkTagDialog
        open={tagOpen}
        count={selection.count}
        busy={bulk.tagging}
        onClose={() => setTagOpen(false)}
        onApply={handleApplyGrammar}
      />
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
