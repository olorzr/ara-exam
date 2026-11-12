'use client';

import { Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, FolderOpen } from 'lucide-react';
import { PageTitle } from '@/components/magazine';
import { SetSourceList } from '@/components/problem-sets';
import { Button } from '@/components/ui/button';
import { useSetSources } from '@/hooks/useSetSources';
import { MOCK_EXAM_SOURCE_TYPE } from '@/lib/problem-bank/school-exam-tree';
import { setArchiveHref, setFromParams, SETS_PATH } from '@/lib/problem-bank/source-set-link';
import { setExamLabel, setTextbookLabel } from '@/lib/problem-bank/source-sets';

/**
 * 세트 한 장 (`/problems/sets/view?type=…`) — 그 세트에 든 학교(모의고사는 과목)를 줄로 늘어놓는다.
 *
 * 세트는 주소의 칸 그대로다(source-set-link.ts — `book=` 빈 값은 '교과서 미지정 세트'). 학교 줄을 누르면 읽기 전용
 * 시험 보기가 열린다. '문제 아카이브에서 보기' 는 아카이브가 같은 범위를 거를 수 있을 때만 낸다 — 교과서가 있고
 * (아카이브는 교과서 '미지정만' 을 못 거른다), 같은 범위에 주관이 다른 모의고사 출처가 없을 때(아카이브에 주관 칸이 없다).
 */
function SetViewContent() {
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const set = useMemo(() => setFromParams(new URLSearchParams(query)), [query]);
  const { rows, outside, loading, error, reload } = useSetSources(set);

  if (!set) {
    return (
      <div className="space-y-3 py-16 text-center text-sm text-gray-500">
        <p>세트를 찾지 못했어요. 주소가 잘렸을 수 있어요.</p>
        <Link href={SETS_PATH} className="font-semibold text-ink underline underline-offset-2">기출 세트 목록으로</Link>
      </div>
    );
  }

  const mock = set.source_type === MOCK_EXAM_SOURCE_TYPE;
  // 아카이브는 같은 범위를 주관 없이 읽는다 — 그 범위에 다른 세트(주관이 다른 모의고사)가 섞여 있으면 숨긴다.
  // 다 읽기 전에도(outside === null) 내지 않는다
  const archiveHref = outside === 0 ? setArchiveHref(set) : null;
  const names = new Set(rows.map((r) => (mock ? r.title : r.school_name))).size;
  const problems = rows.reduce((sum, r) => sum + r.problem_count, 0);

  return (
    <div className="mx-auto max-w-[880px] space-y-4">
      <Link href={SETS_PATH} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        기출 세트
      </Link>

      <div className="border-b-2 border-ink pb-3">
        <PageTitle eyebrow={mock ? '( MOCK ) · MOCK EXAM' : '( SET ) · EXAM SET'}>
          {`${set.year} ${set.grade} ${setExamLabel(set)}`}
        </PageTitle>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-gray-600">
          <span>
            <span className="font-label text-[11px] tracking-[0.14em] text-gray-500">{mock ? 'BOARD' : 'TEXTBOOK'} </span>
            <b className="font-semibold text-ink">{setTextbookLabel(set)}</b>
          </span>
          {rows.length > 0 && (
            <span>{mock ? `과목 ${names}개` : `${names}곳`} · 시험 {rows.length}건 · {problems}문항</span>
          )}
        </p>
      </div>

      {archiveHref && (
        <Link
          href={archiveHref}
          prefetch={false}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink underline underline-offset-2"
        >
          <FolderOpen className="h-4 w-4" aria-hidden="true" />
          이 세트 문항을 문제 아카이브에서 모아 보기
        </Link>
      )}

      {error ? (
        <div className="space-y-3 py-12 text-center text-sm text-gray-500">
          <p>{error}</p>
          <Button type="button" variant="outline" size="sm" onClick={reload}>다시 불러오기</Button>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">이 세트에 든 시험지가 없어요. 지워졌거나 옮겨졌을 수 있어요.</p>
      ) : (
        <SetSourceList rows={rows} />
      )}
    </div>
  );
}

/** useSearchParams 는 Suspense 경계가 필요하다(Next 규약) */
export default function ProblemSetViewPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-gray-500">불러오는 중…</div>}>
      <SetViewContent />
    </Suspense>
  );
}
