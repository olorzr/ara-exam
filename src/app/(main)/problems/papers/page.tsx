'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { OwnerScopeTabs } from '@/components/ui/owner-scope-tabs';
import { useCreatorNames } from '@/hooks/useCreatorNames';
import { usePaperList } from '@/hooks/usePaperList';
import type { OwnerScope } from '@/lib/owner-scope';
import { normalizePaperSettings } from '@/lib/problem-paper/settings';

/** 탭마다 빈 목록 문구 */
const EMPTY_TEXT: Record<OwnerScope, string> = {
  mine: '아직 만든 문제지가 없어요.',
  others: '다른 선생님이 만든 문제지가 없어요.',
};

/**
 * 만든 문제지 목록 (`/problems/papers`).
 *
 * 내가 만든 것과 다른 선생님이 만든 것을 탭으로 가른다 — 들어올 때마다 **내 것부터** 연다.
 * 다른 선생님 것도 열고 지울 수 있다(권한은 그대로 학원 공유다).
 */
export default function ProblemPapersPage() {
  const [scope, setScope] = useState<OwnerScope>('mine');
  const { papers, loading, remove } = usePaperList(scope);
  // 다른 선생님 탭에서만 누가 만들었는지 적는다 — 내 탭은 전부 나다
  const names = useCreatorNames(scope === 'others' ? papers.map((p) => p.user_id) : []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🧩 문제지</h1>
          <p className="mt-1 text-sm text-gray-500">
            아카이브 문항으로 만든 문제지입니다. 본문은 만들 때 굳혀 두어 원본이 바뀌어도 그대로예요.
          </p>
        </div>
        <Link
          href="/problems/papers/new"
          className="shrink-0 rounded-md bg-primary px-3 py-2 text-sm text-white"
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
          <ul className="space-y-2">
            {papers.map((paper) => (
              <li
                key={paper.id}
                className="flex items-center gap-3 rounded-lg border border-gray-200 p-4"
              >
                <Link href={`/problems/papers/${paper.id}`} className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900">
                    {paper.title}
                    {/* 옛 문제지는 키가 없다 — 정규화해서 읽는다(문자열 'true' 로 켜지지 않게) */}
                    {normalizePaperSettings(paper.settings).omr && (
                      <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 align-middle text-xs font-medium text-primary">
                        OMR
                      </span>
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
                <button
                  type="button"
                  onClick={() => remove(paper)}
                  className="shrink-0 rounded p-2 text-gray-400 hover:bg-gray-100"
                  aria-label={`${paper.title} 지우기`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </OwnerScopeTabs>
    </div>
  );
}
