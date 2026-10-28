'use client';

import Link from 'next/link';
import { BookText, Lightbulb, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ReferenceKindChips, ReferenceSidePanel, ReferenceTextList } from '@/components/reference-texts';
import { useOwnerAccess } from '@/hooks/useOwnerAccess';
import { useReferenceTextFacets } from '@/hooks/useReferenceTextFacets';
import { useReferenceTexts } from '@/hooks/useReferenceTexts';
import { ALL_REFERENCE_TEXTS, describeAxis } from '@/lib/reference-texts/filters';
import type { ReferenceTextListItem } from '@/types/reference-text';

/**
 * 작품 전문 · 개념 목록 (`/reference-texts`).
 *
 * 교과서 단원별 지식 창고다(sql/79). **작품** 전문은 문제 만들기(O,X·단답형)가 참고자료로 함께
 * 읽고, **개념** 정리(단원 핵심 개념·제재 개관)는 단원마다 무엇을 가르치는지 한눈에 모아 둔다.
 *
 * 왼쪽 패널로 **교과서 · 단원 / 작품 / 문법** 별로 훑는다(문제 은행 아카이브와 같은 모양).
 * 단원 트리는 카테고리 관리의 단원을 **전부** 보여 줘 비어 있는 단원이 `(0)` 으로 드러난다.
 * 축은 한 번에 하나이고 검색어·종류 칩과 함께 걸린다. 학교 축은 없다(원장님 결정).
 *
 * 읽기는 선생님 모두, **올리기·고치기·지우기는 원장만**이다(2026-10-28 원장님 "전문·개념 올리는 건 나만", sql/84).
 * 원장이 아니면 올리기 단추와 지우기 단추를 그리지 않는다 — 권위는 DB 정책이다.
 */
export default function ReferenceTextsPage() {
  const list = useReferenceTexts();
  const facets = useReferenceTextFacets();
  const { isOwner } = useOwnerAccess();
  const axisLabel = describeAxis(list.axis);

  // 지운 작품이 트리에 남지 않게 실제로 지웠을 때만 트리를 다시 읽는다
  const remove = async (row: ReferenceTextListItem) => {
    if (await list.remove(row)) facets.reload();
  };

  if (list.loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📖 작품 전문 · 개념</h1>
          <p className="mt-1 text-sm text-gray-500">
            교과서 단원마다 작품 원문과 핵심 개념을 평가문제집처럼 모아 둬요. 눌러 보면 말머리 상자·어휘 풀이·여백 해설까지
            문제집 쪽처럼 보이고, 작품 전문은 문제 만들기가 지문과 함께 읽어요(해설은 빼고 원문만).
            {!isOwner && ' 올리기·고치기는 원장님만 할 수 있어요.'}
          </p>
        </div>
        {isOwner && (
          <div className="flex gap-2">
            <Link href="/reference-texts/new">
              <Button className="bg-primary hover:bg-primary-hover text-white">
                <PlusCircle className="mr-2 h-4 w-4" />
                작품 전문 올리기
              </Button>
            </Link>
            <Link href="/reference-texts/new?kind=개념">
              <Button variant="outline">
                <Lightbulb className="mr-2 h-4 w-4" />
                개념 정리 올리기
              </Button>
            </Link>
          </div>
        )}
      </div>

      {list.empty ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-300">
          <BookText className="mb-3 h-12 w-12" />
          <p className="text-sm">아직 올린 작품 전문·개념이 없습니다.</p>
          {isOwner && (
            <Link href="/reference-texts/new" className="mt-4">
              <Button variant="outline" size="sm">첫 작품 전문 올리기</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="lg:sticky lg:top-4 lg:self-start">
            <ReferenceSidePanel
              axis={list.axis}
              rows={facets.rows}
              unitTree={facets.unitTree}
              grammarTree={facets.grammarTree}
              onChange={list.setAxis}
            />
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Input
                value={list.search}
                placeholder="작품명·개념 제목이나 지은이"
                aria-label="작품 전문·개념 검색어"
                className="max-w-sm"
                onChange={(e) => list.setSearch(e.target.value)}
              />
              <ReferenceKindChips value={list.kind} onChange={list.setKind} />
            </div>

            {axisLabel && (
              <p className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                <span className="rounded bg-primary/10 px-2 py-0.5 font-medium text-primary">{axisLabel}</span>
                <button
                  type="button"
                  className="text-xs text-primary underline underline-offset-2"
                  onClick={() => list.setAxis(ALL_REFERENCE_TEXTS)}
                >
                  해제
                </button>
              </p>
            )}

            {list.rows.length === 0 ? (
              <p className="py-16 text-center text-sm text-gray-500">
                {axisLabel || list.kind ? '이 분류에 맞는 것이 없어요.' : '찾는 작품·개념이 없어요.'}
              </p>
            ) : (
              <ReferenceTextList
                rows={list.rows}
                busyId={list.busyId}
                onDelete={isOwner ? (row) => void remove(row) : undefined}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
