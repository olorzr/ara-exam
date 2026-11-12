'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageTitle, SectionLabel } from '@/components/magazine';
import { SetCard, SetFilterBar } from '@/components/problem-sets';
import { Button } from '@/components/ui/button';
import { useSourceSets } from '@/hooks/useSourceSets';
import { MOCK_EXAM_SOURCE_TYPE } from '@/lib/problem-bank/school-exam-tree';
import {
  EMPTY_SET_FILTERS, filterSourceSets, hasActiveSetFilters, setFiltersFromParams, setFiltersToQueryString,
  setNameMatcher, setYearOptions, type SourceSetFilters,
} from '@/lib/problem-bank/source-set-filters';
import { SETS_PATH } from '@/lib/problem-bank/source-set-link';
import { sourceSetKey, type SourceSet } from '@/lib/problem-bank/source-sets';

/** 카드 격자 — 대시보드 번호 꼭지와 같은 간격 */
const GRID_CLASS = 'grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-7 lg:grid-cols-5';

/**
 * 기출 세트 목록 (`/problems/sets`).
 *
 * 기출 공유 사이트의 세트 화면을 옮겼다(2026-11-13 원장님 요청 — "세트 별로 볼 수 있게 … 몇 학기 무슨 학교 나오게").
 * 세트 = 학년도·학년·학기·시험·교과서가 같고 학교만 다른 내신 시험들(모의고사는 같은 회차의 과목들).
 * 카드 → 세트 한 장(학교 목록) → 읽기 전용 시험 보기.
 *
 * 세트는 한 번에 받아(sql/107) 브라우저에서 거르고, 조건은 주소에 싣는다 — 세트를 열었다가 뒤로 와도 그대로다.
 * 주소는 처음 한 번만 읽고 네이티브 `replaceState` 로 적는다('올라간 기출' 화면과 같은 판단).
 */
function SetsContent() {
  const searchParams = useSearchParams();
  const urlQuery = searchParams.toString();
  const [filters, setFilters] = useState<SourceSetFilters>(
    () => setFiltersFromParams(new URLSearchParams(urlQuery)),
  );
  const { sets, loading, error, reload } = useSourceSets();

  // 바깥에서 주소가 바뀌면(이 화면에서 사이드바 '기출 세트' 를 다시 누르는 등) 거르기를 주소에 맞춘다(코덱스 1R).
  // App Router 는 같은 쪽이면 상태를 지켜, 그대로 두면 주소는 비었는데 목록은 옛 조건으로 남는다.
  // 이 화면이 직접 적은 주소(`replaceState`)는 지금 거르기와 같은 글자라 아무것도 안 바뀐다 — 렌더 중 파생 상태로 맞춘다
  const [seenQuery, setSeenQuery] = useState(urlQuery);
  if (seenQuery !== urlQuery) {
    setSeenQuery(urlQuery);
    const fromUrl = setFiltersFromParams(new URLSearchParams(urlQuery));
    if (setFiltersToQueryString(fromUrl) !== setFiltersToQueryString(filters)) setFilters(fromUrl);
  }

  useEffect(() => {
    window.history.replaceState(null, '', `${SETS_PATH}${setFiltersToQueryString(filters)}`);
  }, [filters]);

  const shown = useMemo(() => filterSourceSets(sets, filters), [sets, filters]);
  const yearOptions = useMemo(() => setYearOptions(sets), [sets]);
  const match = setNameMatcher(filters.q);
  const schoolSets = shown.filter((s) => s.source_type !== MOCK_EXAM_SOURCE_TYPE);
  const mockSets = shown.filter((s) => s.source_type === MOCK_EXAM_SOURCE_TYPE);
  const examCount = sets.reduce((sum, s) => sum + s.exam_count, 0);

  const patch = (next: Partial<SourceSetFilters>) => setFilters((prev) => ({ ...prev, ...next }));
  const reset = () => setFilters(EMPTY_SET_FILTERS);

  return (
    <div className="mx-auto max-w-[1080px] space-y-6">
      <div className="border-b-2 border-ink pb-3">
        <PageTitle eyebrow="PROBLEM BANK · EXAM SETS">기출 세트</PageTitle>
        <p className="mt-1 text-sm text-gray-500">
          학년도·학년·학기·시험·교과서가 같은 기출을 학교별로 모았어요. 세트를 누르면 학교 목록이, 학교를 누르면 시험지가 열려요.
          {sets.length > 0 && <span className="ml-1 text-gray-400">(세트 {sets.length}장 · 시험 {examCount}건)</span>}
        </p>
      </div>

      <SetFilterBar filters={filters} yearOptions={yearOptions} shown={shown.length} onChange={patch} onReset={reset} />

      {error && sets.length === 0 ? (
        <div className="space-y-3 py-12 text-center text-sm text-gray-500">
          <p>{error}</p>
          <Button type="button" variant="outline" size="sm" onClick={reload}>다시 불러오기</Button>
        </div>
      ) : loading && sets.length === 0 ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : shown.length === 0 ? (
        <div className="space-y-3 py-12 text-center text-sm text-gray-500">
          <p>{hasActiveSetFilters(filters) ? '조건에 맞는 세트가 없어요.' : '아직 세트로 묶을 기출이 없어요.'}</p>
          {hasActiveSetFilters(filters) && (
            <Button type="button" variant="outline" size="sm" onClick={reset}>조건 지우기</Button>
          )}
        </div>
      ) : (
        <>
          <SetSection en="SCHOOL EXAMS" title="내신 기출" sets={schoolSets} match={match} />
          <SetSection en="MOCK EXAMS" title="모의고사·수능" sets={mockSets} match={match} />
        </>
      )}
    </div>
  );
}

/** 섹션 하나 — 비면 그리지 않는다. 카드 번호는 섹션마다 1부터 */
function SetSection({ en, title, sets, match }: {
  en: string;
  title: string;
  sets: SourceSet[];
  match?: (name: string) => boolean;
}) {
  if (sets.length === 0) return null;
  const id = `sets-${en.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <section aria-labelledby={id} className="space-y-3.5">
      <SectionLabel en={en}><span id={id}>{title} · {sets.length}장</span></SectionLabel>
      <ul className={GRID_CLASS}>
        {sets.map((set, index) => (
          <SetCard key={sourceSetKey(set)} set={set} no={index + 1} match={match} />
        ))}
      </ul>
    </section>
  );
}

/** useSearchParams 는 Suspense 경계가 필요하다(Next 규약) */
export default function ProblemSetsPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-gray-500">불러오는 중…</div>}>
      <SetsContent />
    </Suspense>
  );
}
