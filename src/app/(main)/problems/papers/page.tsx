'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { OwnerScopeTabs } from '@/components/ui/owner-scope-tabs';
import { useCreatorNames } from '@/hooks/useCreatorNames';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePaperEditStates } from '@/hooks/usePaperEditStates';
import { usePaperList } from '@/hooks/usePaperList';
import { usePaperTabCount } from '@/hooks/usePaperTabCount';
import { OWNER_SCOPE_LABELS, type OwnerScope } from '@/lib/owner-scope';
import { PAPER_LIST_LIMIT } from '@/lib/problem-paper/paper-list';
import { PageTitle, PaperList } from '@/components/magazine';
import { Button } from '@/components/ui/button';
import PaperListRow from '@/components/problem-paper/PaperListRow';
import PaperListSearch from '@/components/problem-paper/PaperListSearch';

/** 탭마다 빈 목록 문구 */
const EMPTY_TEXT: Record<OwnerScope, string> = {
  mine: '아직 만든 문제지가 없어요.',
  others: '다른 선생님이 만든 문제지가 없어요.',
};

/** 찾는 말을 칠 때 기다리는 시간 — 고르기 창(PaperExcludePickerDialog)과 같다 */
const SEARCH_DEBOUNCE_MS = 300;

/** 반대 탭 */
const OTHER: Record<OwnerScope, OwnerScope> = { mine: 'others', others: 'mine' };

/** 탭 이름 옆 숫자 — 상한에 닿았으면 '200+' */
const countText = (count: number, capped: boolean) => (capped ? `${count}+` : String(count));

/**
 * 만든 문제지 목록 (`/problems/papers`).
 *
 * 내가 만든 것과 다른 선생님이 만든 것을 탭으로 가른다 — 들어올 때마다 **내 것부터** 연다.
 * 다른 선생님 것도 열어 보고 인쇄할 수 있다. **고치기**는 만든 선생님과 원장만이라 연필은 고칠 수 있는 문제지에만
 * 그린다(책에 담기면 원장만, OMR 은 채점 전까지만 — sql/103). **지우기**도 만든 선생님과 원장만이라(sql/104) 휴지통은
 * 그 사람에게만 그린다.
 * 찾기 칸 하나가 두 탭에 걸린다(2026-11-22) — 제목·만든 선생님 이름으로 서버에서 찾고, 찾는 동안 탭마다 몇 개인지 보인다.
 */
export default function ProblemPapersPage() {
  const [scope, setScope] = useState<OwnerScope>('mine');
  const [search, setSearch] = useState('');
  const keyword = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const { papers, loading, capped, canDelete, remove } = usePaperList(scope, keyword);
  const other = usePaperTabCount(OTHER[scope], keyword);
  // 다른 선생님 탭에서만 누가 만들었는지 적는다 — 내 탭은 전부 나다
  const names = useCreatorNames(scope === 'others' ? papers.map((p) => p.user_id) : []);
  const { states: editStates } = usePaperEditStates(papers.map((p) => p.id));

  const counts = keyword && !loading
    ? {
      [scope]: countText(papers.length, capped),
      ...(other.count !== null ? { [OTHER[scope]]: countText(other.count, other.capped) } : {}),
    }
    : undefined;
  const emptyText = keyword ? `'${keyword}'(으)로 찾은 문제지가 없어요.` : EMPTY_TEXT[scope];

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

      <PaperListSearch value={search} onChange={setSearch} />

      <OwnerScopeTabs value={scope} onChange={setScope} counts={counts}>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        ) : papers.length === 0 ? (
          <Card>
            <CardContent className="space-y-3 py-12 text-center text-sm text-gray-500">
              <p>{emptyText}</p>
              {keyword && other.count !== null && other.count > 0 && (
                <Button type="button" variant="outline" size="sm" onClick={() => setScope(OTHER[scope])}>
                  {OWNER_SCOPE_LABELS[OTHER[scope]]}에서 {countText(other.count, other.capped)}개 보기
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          // 종이 목록 한 장 — 예전엔 줄마다 따로 테두리 상자였다(2026-11-14, 학교 프린트 목록과 같은 결)
          <>
            <PaperList>
              {papers.map((paper, index) => (
                <PaperListRow
                  key={paper.id}
                  paper={paper}
                  n={index + 1}
                  creator={names.get(paper.user_id)}
                  editState={editStates.get(paper.id)}
                  onRemove={canDelete(paper) ? () => remove(paper) : undefined}
                />
              ))}
            </PaperList>
            {capped && (
              <p className="mt-2 text-xs text-gray-400">
                {keyword
                  ? `찾은 것 가운데 최근 ${PAPER_LIST_LIMIT}개만 보여요 — 더 좁혀 찾아 주세요.`
                  : `최근 ${PAPER_LIST_LIMIT}개만 보여요 — 제목이나 선생님 이름으로 찾아 주세요.`}
              </p>
            )}
          </>
        )}
      </OwnerScopeTabs>
    </div>
  );
}
