'use client';

import Link from 'next/link';
import { BookText, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ReferenceSidePanel, ReferenceTextList } from '@/components/reference-texts';
import { useReferenceTextFacets } from '@/hooks/useReferenceTextFacets';
import { useReferenceTexts } from '@/hooks/useReferenceTexts';
import { ALL_REFERENCE_TEXTS, describeAxis } from '@/lib/reference-texts/filters';
import type { ReferenceTextListItem } from '@/types/reference-text';

/**
 * 작품 전문 목록 (`/reference-texts`).
 *
 * 여기 올려 둔 전문은 문제 만들기(O,X·단답형)가 **참고자료로 함께 읽는다** — 시험지에는
 * 작품의 일부만 실리는데, 전문이 있으면 잘린 지문만으로는 낼 수 없는 문항까지 근거와 함께
 * 만들 수 있다.
 *
 * 왼쪽 패널로 **교과서 · 단원 / 작품 / 문법** 별로 훑는다(문제 은행 아카이브와 같은 모양).
 * 축은 한 번에 하나이고 검색어와 함께 걸린다. 학교 축은 없다(원장님 결정).
 */
export default function ReferenceTextsPage() {
  const list = useReferenceTexts();
  const facets = useReferenceTextFacets();
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
          <h1 className="text-2xl font-bold text-gray-900">📖 작품 전문</h1>
          <p className="mt-1 text-sm text-gray-500">
            작품 원문을 올려 두면 문제 만들기가 지문과 함께 읽어요. 교과서 단원·문법을 붙이면
            왼쪽에서 교과서별·작품별로 찾을 수 있어요.
          </p>
        </div>
        <Link href="/reference-texts/new">
          <Button className="bg-primary hover:bg-primary-hover text-white">
            <PlusCircle className="mr-2 h-4 w-4" />
            새 전문 올리기
          </Button>
        </Link>
      </div>

      {list.empty ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-300">
          <BookText className="mb-3 h-12 w-12" />
          <p className="text-sm">아직 올린 전문이 없습니다.</p>
          <Link href="/reference-texts/new" className="mt-4">
            <Button variant="outline" size="sm">첫 전문 올리기</Button>
          </Link>
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
            <Input
              value={list.search}
              placeholder="작품명이나 지은이"
              aria-label="전문 검색어"
              className="max-w-sm"
              onChange={(e) => list.setSearch(e.target.value)}
            />

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
                {axisLabel ? '이 분류에 맞는 전문이 없어요.' : '찾는 작품이 없어요.'}
              </p>
            ) : (
              <ReferenceTextList rows={list.rows} busyId={list.busyId} onDelete={(row) => void remove(row)} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
