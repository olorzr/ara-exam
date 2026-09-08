'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useProblemReview } from '@/hooks/useProblemReview';
import { fetchAreaSets, fetchAreaTree, pickAreaSetForGrade } from '@/lib/problem-bank/area-master';
import type { AreaTreeNode } from '@/lib/problem-bank/area-tree';
import { setSourceStatus } from '@/lib/problem-bank/mutations';
import { sourceLabel } from '@/lib/problem-bank/source-label';
import PageImageWithBoxes, { type BoxOverlay } from '@/components/problem-review/PageImageWithBoxes';
import PassageEditorCard from '@/components/problem-review/PassageEditorCard';
import ProblemEditorCard from '@/components/problem-review/ProblemEditorCard';
import OcrProgress from '@/components/problem-ocr/OcrProgress';
import { toBbox } from '@/lib/problem-bank/bbox';

/**
 * 기출 검수 화면 (`/problems/sources/[id]`).
 *
 * 왼쪽에 원본 페이지, 오른쪽에 읽어 낸 지문·문항을 둔다.
 * **원본과 대조**하는 것이 검수의 핵심이라 두 화면을 나란히 본다.
 */
export default function ProblemSourceReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const sourceId = params?.id ?? '';
  const review = useProblemReview(sourceId);

  const [areaTree, setAreaTree] = useState<AreaTreeNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /**
   * 저장하지 않은 수정이 있는 문항.
   *
   * ⚠️ 이걸 안 보면 고치던 내용을 버린 채 출처가 '완료' 로 굳는다 — 검수한 자료인 줄
   *    알고 그대로 인쇄하게 된다(코덱스 리뷰 14R).
   */
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [wantedPage, setPage] = useState(1);

  useEffect(() => {
    if (!review.source) return;
    let alive = true;
    fetchAreaSets().then(async (sets) => {
      const setId = pickAreaSetForGrade(sets, review.source?.grade ?? '');
      const tree = setId ? await fetchAreaTree(setId) : [];
      if (alive) setAreaTree(tree);
    });
    return () => { alive = false; };
  }, [review.source]);

  // 화면에 보이는 쪽 목록.
  //
  // 항목이 있는 쪽만 세면 **정답표 쪽이 빠진다**(정답표에는 문항 행이 없다).
  // 이어지는 쪽도 빠진다(합쳐진 지문은 시작 쪽만 들고 있다).
  // 그래서 OCR 이 실제로 읽은 쪽(ocr_meta.pages)을 합집합으로 더한다(코덱스 리뷰 4R).
  const pages = useMemo(() => {
    const set = new Set<number>();
    review.passages.forEach((p) => set.add(p.page_no));
    review.problems.forEach((p) => set.add(p.page_no));
    (review.source?.ocr_meta?.pages ?? []).forEach((n) => set.add(n));
    return [...set].filter((n) => Number.isInteger(n) && n >= 1).sort((a, b) => a - b);
  }, [review.passages, review.problems, review.source]);

  // 보고 있던 쪽이 목록에서 사라지면(항목을 다 지웠을 때) 첫 쪽으로 떨어뜨린다.
  // state 를 효과로 되돌리지 않고 **파생**한다 — 렌더가 한 번 더 도는 것을 막는다.
  const page = pages.includes(wantedPage) ? wantedPage : pages[0] ?? 1;

  const boxes = useMemo<BoxOverlay[]>(() => {
    const out: BoxOverlay[] = [];
    for (const passage of review.passages) {
      if (passage.page_no !== page) continue;
      const bbox = toBbox(passage.bbox);
      if (bbox) out.push({ id: passage.id, bbox, label: '지문', kind: 'passage' });
    }
    for (const problem of review.problems) {
      if (problem.page_no !== page) continue;
      const bbox = toBbox(problem.bbox);
      if (bbox) {
        out.push({
          id: problem.id,
          bbox,
          label: problem.number !== null ? `${problem.number}` : '?',
          kind: 'problem',
        });
      }
    }
    return out;
  }, [review.passages, review.problems, page]);

  /** 지문 다음에 그 지문의 문항이 오도록 늘어놓는다 — 검수 순서가 읽는 순서와 같아야 한다 */
  const ordered = useMemo(() => {
    const rows: ({ kind: 'passage'; id: string } | { kind: 'problem'; id: string })[] = [];
    const used = new Set<string>();
    for (const passage of review.passages) {
      rows.push({ kind: 'passage', id: passage.id });
      for (const problem of review.problems) {
        if (problem.passage_id === passage.id) {
          rows.push({ kind: 'problem', id: problem.id });
          used.add(problem.id);
        }
      }
    }
    for (const problem of review.problems) {
      if (!used.has(problem.id)) rows.push({ kind: 'problem', id: problem.id });
    }
    return rows;
  }, [review.passages, review.problems]);

  const problemCountFor = (passageId: string) =>
    review.problems.filter((p) => p.passage_id === passageId).length;

  const markDirty = useCallback((id: string, dirty: boolean) => {
    setDirtyIds((prev) => {
      if (prev.has(id) === dirty) return prev;
      const next = new Set(prev);
      if (dirty) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const finish = async () => {
    if (dirtyIds.size > 0) {
      const ok = window.confirm(
        `저장하지 않은 문항·지문이 ${dirtyIds.size}개 있어요.\n`
        + '지금 마치면 그 수정은 사라지고 옛 내용이 검수한 자료로 남습니다. 계속할까요?',
      );
      if (!ok) return;
    }
    try {
      await setSourceStatus(sourceId, '완료');
      toast.success('검수를 마쳤어요. 아카이브에서 문제지에 담을 수 있어요.');
      router.push('/problems/archive');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '상태를 바꾸지 못했어요.');
    }
  };

  if (review.loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (review.error || !review.source) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-gray-500">
          {review.error ?? '출처를 찾지 못했어요.'}
        </CardContent>
      </Card>
    );
  }

  const source = review.source;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{source.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
            <Badge variant="outline">{source.source_type}</Badge>
            {sourceLabel(source)}
            <span>· 문항 {review.problems.length}개 (검수 {review.verifiedCount})</span>
          </p>
        </div>
        <Button type="button" onClick={finish} disabled={source.status === '완료'}>
          {source.status === '완료' ? '검수 완료됨' : '검수 마치기'}
        </Button>
      </div>

      <OcrProgress progress={null} label="" warnings={source.ocr_meta?.warnings ?? []} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-2 lg:sticky lg:top-4 lg:self-start">
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-sm text-gray-500">쪽</span>
            {pages.map((n) => (
              <Button
                key={n} type="button" size="sm"
                variant={n === page ? 'default' : 'outline'}
                onClick={() => setPage(n)}
              >
                {n}
              </Button>
            ))}
          </div>
          <PageImageWithBoxes
            src={review.pageUrlFor(page)}
            boxes={boxes}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              document
                .querySelector(`[data-problem-id="${id}"], [data-passage-id="${id}"]`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
          />
        </div>

        <div className="space-y-3">
          {ordered.length === 0 && (
            <Card>
              <CardContent className="space-y-3 py-12 text-center text-sm text-gray-500">
                <p>읽어 낸 문항이 없어요.</p>
                {/* 실패·취소한 작업에서 실제로 돌아갈 곳을 준다 — 안내만 하고 길이 없으면 막힌다 */}
                <Link
                  href="/problems/upload"
                  className="inline-block rounded-md bg-primary px-3 py-2 text-sm text-white"
                >
                  다시 업로드하기
                </Link>
              </CardContent>
            </Card>
          )}

          {ordered.map((row) => {
            if (row.kind === 'passage') {
              const passage = review.passages.find((p) => p.id === row.id);
              if (!passage) return null;
              return (
                <PassageEditorCard
                  key={`${passage.id}:${review.reloadSeq}`}
                  passage={passage}
                  problemCount={problemCountFor(passage.id)}
                  areaTree={areaTree}
                  selected={selectedId === passage.id}
                  // 이미 고른 항목을 다시 누르거나(편집 중 포커스) 하면 쪽은 그대로 둔다 —
                  // 여러 쪽에 걸친 지문을 이어지는 쪽과 대조하며 고칠 수 있어야 한다
                  onSelect={() => {
                    if (selectedId !== passage.id) setPage(passage.page_no);
                    setSelectedId(passage.id);
                  }}
                  onSave={(patch) => review.savePassage(passage.id, patch)}
                  onDirtyChange={(dirty) => markDirty(passage.id, dirty)}
                  onDelete={() => {
                    // 지문을 지우면 딸린 문항을 다시 읽어 오면서 **모든 카드가 다시
                    // 마운트된다** — 다른 카드에서 고치던 내용까지 사라진다.
                    // 지우는 카드 자신은 어차피 없어지므로 셈에서 뺀다(코덱스 리뷰 16R)
                    const others = [...dirtyIds].filter((id) => id !== passage.id);
                    if (others.length > 0) {
                      const ok = window.confirm(
                        `다른 카드에 저장하지 않은 수정이 ${others.length}개 있어요.\n`
                        + '지문을 지우면 문항을 다시 읽어 오면서 그 수정이 사라집니다. 계속할까요?',
                      );
                      if (!ok) return;
                    }
                    review.removePassage(passage.id);
                  }}
                />
              );
            }
            const problem = review.problems.find((p) => p.id === row.id);
            if (!problem) return null;
            return (
              <ProblemEditorCard
                // 서버 본문을 다시 읽으면 카드도 다시 마운트한다 —
                // 옛 입력이 남은 채 새 토큰으로 저장되면 남의 수정을 덮어쓴다
                key={`${problem.id}:${review.reloadSeq}`}
                problem={problem}
                areaTree={areaTree}
                selected={selectedId === problem.id}
                onSelect={() => {
                  if (selectedId !== problem.id) setPage(problem.page_no);
                  setSelectedId(problem.id);
                }}
                onSave={(patch) => review.saveProblem(problem.id, patch)}
                onDirtyChange={(dirty) => markDirty(problem.id, dirty)}
                // 방금 저장해서 알고 있는 버전을 **그대로 넘긴다** — 버리면 저장 직후
                // 검수가 옛 버전으로 걸려 아무도 안 고쳤는데 충돌한다
                onToggleVerified={(v, knownUpdatedAt) => (
                  review.toggleVerified(problem.id, v, knownUpdatedAt)
                )}
                onDelete={() => review.removeProblem(problem.id)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
