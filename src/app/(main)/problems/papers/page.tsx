'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { OwnerScopeTabs } from '@/components/ui/owner-scope-tabs';
import { useCreatorNames } from '@/hooks/useCreatorNames';
import { usePaperEditStates } from '@/hooks/usePaperEditStates';
import { usePaperList } from '@/hooks/usePaperList';
import type { OwnerScope } from '@/lib/owner-scope';
import { paperEditHref } from '@/lib/problem-paper/paper-edit';
import { normalizePaperSettings } from '@/lib/problem-paper/settings';
import { ItemNo, PageTitle, PaperList } from '@/components/magazine';
import { Badge } from '@/components/ui/badge';

/** 탭마다 빈 목록 문구 */
const EMPTY_TEXT: Record<OwnerScope, string> = {
  mine: '아직 만든 문제지가 없어요.',
  others: '다른 선생님이 만든 문제지가 없어요.',
};

/**
 * 만든 문제지 목록 (`/problems/papers`).
 *
 * 내가 만든 것과 다른 선생님이 만든 것을 탭으로 가른다 — 들어올 때마다 **내 것부터** 연다.
 * 다른 선생님 것도 열어 보고 인쇄할 수 있다. **고치기**는 만든 선생님과 원장만이라 연필은 고칠 수 있는 문제지에만
 * 그린다(책에 담기면 원장만, OMR 은 채점 전까지만 — sql/103). **지우기**도 만든 선생님과 원장만이라(sql/104) 휴지통은
 * 그 사람에게만 그린다.
 */
export default function ProblemPapersPage() {
  const [scope, setScope] = useState<OwnerScope>('mine');
  const { papers, loading, canDelete, remove } = usePaperList(scope);
  // 다른 선생님 탭에서만 누가 만들었는지 적는다 — 내 탭은 전부 나다
  const names = useCreatorNames(scope === 'others' ? papers.map((p) => p.user_id) : []);
  const { states: editStates } = usePaperEditStates(papers.map((p) => p.id));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-ink pb-3">
        <div>
          <PageTitle eyebrow="PROBLEM BANK">문제지</PageTitle>
          <p className="mt-1 text-sm text-gray-500">
            아카이브 문항으로 만든 문제지입니다. 본문은 만들 때 굳혀 두어 원본이 바뀌어도 그대로예요.
            만든 뒤에도 연필을 눌러 순서를 바꾸거나 문항을 넣고 뺄 수 있어요.
          </p>
        </div>
        <Link
          href="/problems/papers/new"
          className="shrink-0 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink/85"
        >
          + 문제지 만들기
        </Link>
      </div>

      <OwnerScopeTabs value={scope} onChange={setScope}>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        ) : papers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-gray-500">
              {EMPTY_TEXT[scope]}
            </CardContent>
          </Card>
        ) : (
          // 종이 목록 한 장 — 예전엔 줄마다 따로 테두리 상자였다(2026-11-14, 학교 프린트 목록과 같은 결)
          <PaperList>
            {papers.map((paper, index) => (
              <li key={paper.id} className="flex items-start gap-2 px-4 py-3">
                <ItemNo n={index + 1} />
                <Link href={`/problems/papers/${paper.id}`} className="group min-w-0 flex-1">
                  <p className="text-[15px] leading-snug font-semibold break-keep [overflow-wrap:anywhere] text-ink group-hover:text-primary">
                    {paper.title}
                    {/* 옛 문제지는 키가 없다 — 정규화해서 읽는다(문자열 'true' 로 켜지지 않게) */}
                    {normalizePaperSettings(paper.settings).omr && (
                      <Badge className="ml-2 align-middle">OMR</Badge>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {names.get(paper.user_id) && `${names.get(paper.user_id)} 선생님 · `}
                    {paper.total_questions}문항
                    {paper.source_labels.length > 0 && ` · ${paper.source_labels.join(', ')}`}
                    {' · '}
                    {new Date(paper.created_at).toLocaleDateString('ko-KR')}
                  </p>
                </Link>
                {editStates.get(paper.id)?.reason === null && (
                  <Link
                    href={paperEditHref(paper.id, editStates.get(paper.id) ?? { inBook: false, workbook: false })}
                    className="shrink-0 rounded-full p-2 text-gray-400 hover:bg-accent-soft hover:text-ink"
                    aria-label={`${paper.title} 고치기`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
                )}
                {canDelete(paper) && (
                  <button
                    type="button"
                    onClick={() => remove(paper)}
                    className="shrink-0 rounded-full p-2 text-gray-400 hover:bg-red-50 hover:text-red-500"
                    aria-label={`${paper.title} 지우기`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </PaperList>
        )}
      </OwnerScopeTabs>
    </div>
  );
}
