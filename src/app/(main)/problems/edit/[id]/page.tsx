'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import ProblemEditorCard from '@/components/problem-review/ProblemEditorCard';
import { fetchAreaSets, fetchAreaTree, pickAreaSetForGrade } from '@/lib/problem-bank/area-master';
import type { AreaTreeNode } from '@/lib/problem-bank/area-tree';
import {
  ConflictError, deleteProblem, setProblemVerified, updateProblem, type ProblemPatch,
} from '@/lib/problem-bank/mutations';
import { fetchProblem, fetchSource } from '@/lib/problem-bank/queries';
import { sourceLabel } from '@/lib/problem-bank/source-label';
import type { Problem, ProblemSource } from '@/types/problem-bank';

/**
 * 문항 한 개 편집 (`/problems/edit/[id]`).
 * 아카이브 목록에서만 들어온다 — 검수 화면(`/problems/sources/[id]`)은 출처 단위다.
 */
export default function ProblemEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const problemId = params?.id ?? '';

  const [problem, setProblem] = useState<Problem | null>(null);
  const [source, setSource] = useState<ProblemSource | null>(null);
  const [areaTree, setAreaTree] = useState<AreaTreeNode[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const row = await fetchProblem(problemId);
        if (!alive) return;
        setProblem(row);
        if (row) {
          const src = await fetchSource(row.source_id);
          if (!alive) return;
          setSource(src);
          const sets = await fetchAreaSets();
          const setId = pickAreaSetForGrade(sets, src?.grade ?? '');
          const tree = setId ? await fetchAreaTree(setId) : [];
          if (alive) setAreaTree(tree);
        }
      } catch (e) {
        if (alive) toast.error(e instanceof Error ? e.message : '불러오지 못했어요.');
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, [problemId]);

  /**
   * 문항을 저장한다.
   * @returns 새 `updated_at`. 실패하면 null — 저장 직후 검수까지 이어질 때
   *   화면 state 가 아직 안 돌아도 맞는 버전을 쓸 수 있어야 한다
   */
  const save = async (patch: ProblemPatch): Promise<string | null> => {
    if (!problem) return null;
    try {
      const updatedAt = await updateProblem(problem.id, problem.updated_at, patch);
      setProblem({ ...problem, ...patch, updated_at: updatedAt } as Problem);
      toast.success('저장했어요.');
      return updatedAt;
    } catch (e) {
      toast.error(e instanceof ConflictError ? e.message : '저장하지 못했어요.');
      return null;
    }
  };

  if (!loaded) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!problem) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-gray-500">
          문항을 찾지 못했어요.{' '}
          <Link href="/problems/archive" className="text-primary underline underline-offset-2">
            아카이브로
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">✏️ 문항 편집</h1>
        {source && (
          <p className="mt-1 text-sm text-gray-500">
            {source.title} · {sourceLabel(source)} · {problem.page_no}쪽
          </p>
        )}
      </div>

      <ProblemEditorCard
        key={problem.id}
        problem={problem}
        areaTree={areaTree}
        selected
        onSelect={() => { /* 단건 화면이라 선택 개념이 없다 */ }}
        onSave={save}
        onToggleVerified={async (verified, knownUpdatedAt) => {
          try {
            // 검수 토글도 updated_at 을 바꾼다 — 같이 갱신해야 다음 저장이 충돌하지 않는다.
            // 방금 저장했다면 그때 받은 버전을 쓴다(화면 state 는 아직 안 돌았다)
            const updatedAt = await setProblemVerified(
              problem.id, knownUpdatedAt ?? problem.updated_at, verified,
            );
            // ⚠️ 바깥의 `problem` 을 펼치면 **방금 저장한 값이 옛 값으로 되돌아간다**
            //    (이 클로저는 저장 전 상태를 붙잡고 있다). 최신 상태 위에서 두 칸만 바꾼다
            setProblem((prev) => (prev
              ? { ...prev, status: verified ? '검수완료' : '초안', updated_at: updatedAt }
              : prev));
          } catch (e) {
            toast.error(e instanceof ConflictError ? e.message : '저장하지 못했어요.');
          }
        }}
        onDelete={async () => {
          try {
            await deleteProblem(problem.id);
            toast.success('문항을 지웠어요.');
            router.push('/problems/archive');
          } catch {
            toast.error('지우지 못했어요.');
          }
        }}
      />
    </div>
  );
}
