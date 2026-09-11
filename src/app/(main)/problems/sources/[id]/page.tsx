'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useProblemReview } from '@/hooks/useProblemReview';
import { useReviewFocus } from '@/hooks/useReviewFocus';
import { useSourceTrees } from '@/hooks/useSourceTrees';
import { useAiEnabled } from '@/hooks/useAiEnabled';
import { usePassageContinuation } from '@/hooks/usePassageContinuation';
import { useReviewGuards } from '@/hooks/useReviewGuards';
import { setSourceStatus } from '@/lib/problem-bank/mutations-source';
import PageImageWithBoxes, { type BoxOverlay } from '@/components/problem-review/PageImageWithBoxes';
import ReviewCardList, { type ReviewRow } from '@/components/problem-review/ReviewCardList';
import ReviewHeader from '@/components/problem-review/ReviewHeader';
import AnswerKeyFiles from '@/components/problem-review/AnswerKeyFiles';
import OcrProgress from '@/components/problem-ocr/OcrProgress';
import { toBbox } from '@/lib/problem-bank/bbox';
import type { Bbox } from '@/types/problem-bank';
import { issuesByTargetId } from '@/lib/problem-ocr/warnings';

/**
 * 기출 검수 화면 (`/problems/sources/[id]`).
 *
 * 왼쪽에 원본 페이지, 오른쪽에 읽어 낸 지문·문항을 둔다.
 * **원본과 대조**하는 것이 검수의 핵심이라 두 화면을 나란히 본다.
 */
function ProblemSourceReviewContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sourceId = params?.id ?? '';
  const review = useProblemReview(sourceId);

  const { areaTree, unitTree } = useSourceTrees(review.source);
  const ai = useAiEnabled();
  // 이미 저장된 지문이 잘려 있을 때 그 쪽 한 장만 다시 읽는다(ChatGPT 1회)
  const continuation = usePassageContinuation(review.source);
  /**
   * 저장하지 않은 수정이 있는 문항.
   *
   * ⚠️ 이걸 안 보면 고치던 내용을 버린 채 출처가 '완료' 로 굳는다 — 검수한 자료인 줄
   *    알고 그대로 인쇄하게 된다(코덱스 리뷰 14R).
   */
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  // 원본에서 영역을 기다리는 카드와, 잡은 영역을 돌려줄 함수. 한 번에 한 카드만
  // 잡으므로 함수를 그냥 들고 있으면 된다 — 저장은 본문을 아는 카드가 한다
  const [capture, setCapture] = useState<
    { id: string; onBbox: (bbox: Bbox, pageUrl: string) => void } | null
  >(null);

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

  // 어디를 보고 있는가(쪽·강조·스크롤)는 훅 하나가 맡는다 — 상자·카드·경고 칩이
  // 서로 다르게 움직이면 "경고를 눌렀는데 다른 쪽이 보이는" 일이 생긴다
  const focus = useReviewFocus({
    pages,
    items: [...review.passages, ...review.problems],
    loading: review.loading,
    // 주소는 처음 한 번만 읽는다 — 이후 선택은 화면이 들고 있다
    wantedItem: useState(() => searchParams.get('item'))[0],
  });
  const { page } = focus;

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
    const rows: ReviewRow[] = [];
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

  /**
   * OCR 경고를 항목별로 나눈다 — 위 배너와 **같은 말**이 그 카드에도 붙는다.
   * 배너만 있으면 "어느 문항?" 을 사람이 눈으로 찾아야 한다.
   */
  const issues = useMemo(
    () => issuesByTargetId(review.source?.ocr_meta?.warnings ?? []),
    [review.source],
  );

  // 미저장 수정을 지키는 확인 절차는 한 곳에 모아 둔다 — 세 가지가 규칙이 서로 다르다
  const guards = useReviewGuards(review, dirtyIds);

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

  if (review.loading || review.busy) {
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
      <ReviewHeader
        source={source}
        problemCount={review.problems.length}
        verifiedCount={review.verifiedCount}
        onTextbook={(textbook) => review.changeTextbook(textbook, () => dirtyIds.size)}
        onFinish={finish}
      />

      <OcrProgress
        progress={null}
        label=""
        warnings={source.ocr_meta?.warnings ?? []}
        onTarget={focus.goToTarget}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-2 lg:sticky lg:top-4 lg:self-start">
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-sm text-gray-500">쪽</span>
            {pages.map((n) => (
              <Button
                key={n} type="button" size="sm"
                variant={n === page ? 'default' : 'outline'}
                onClick={() => focus.setPage(n)}
              >
                {n}
              </Button>
            ))}
          </div>
          <AnswerKeyFiles paths={source.answer_key_paths ?? []} />
          {capture && (
            <p className="rounded border border-primary bg-primary/5 px-2 py-1 text-xs text-primary">
              원본에서 그림을 <strong>끌어서</strong> 잡아 주세요. 잡으면 그 카드의 본문 끝에 붙습니다.
              <button
                type="button"
                onClick={() => setCapture(null)}
                className="ml-2 underline underline-offset-2"
              >
                그만두기
              </button>
            </p>
          )}
          <PageImageWithBoxes
            src={review.pageUrlFor(page)}
            boxes={boxes}
            selectedId={focus.selectedId}
            onSelect={(id) => focus.focusItem(id)}
            capturing={Boolean(capture)}
            onCapture={(bbox) => {
              const url = review.pageUrlFor(page);
              if (!url) {
                toast.error('이 쪽의 원본 이미지가 없어 그림을 잘라낼 수 없어요.');
                return;
              }
              capture?.onBbox(bbox, url);
              setCapture(null);
            }}
          />
        </div>

        <div className="space-y-3">
          <ReviewCardList
            rows={ordered}
            passages={review.passages}
            problems={review.problems}
            mountKey={review.mountKey}
            areaTree={areaTree}
            unitTree={unitTree}
            selectedId={focus.selectedId}
            issues={issues}
            onSelect={focus.selectCard}
            onDirtyChange={markDirty}
            savePassage={guards.savePassage}
            saveProblem={review.saveProblem}
            toggleVerified={review.toggleVerified}
            deletePassage={guards.removePassage}
            deleteProblem={review.removeProblem}
            continuePassage={ai.features.problem_ocr
              ? (id, page, soFarHtml) => continuation.read(id, page, soFarHtml)
              : undefined}
            continuingId={continuation.busyId}
            sourcePageCount={source.page_count}
            mergePassage={guards.mergePassage}
            figureUrls={review.figureUrls}
            capturingId={capture?.id ?? null}
            onStartCapture={(id, onBbox) => setCapture(
              (prev) => (prev?.id === id ? null : { id, onBbox }),
            )}
          />
        </div>
      </div>
    </div>
  );
}

/** useSearchParams 는 Suspense 경계가 필요하다(Next 규약) */
export default function ProblemSourceReviewPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-gray-500">불러오는 중…</div>}>
      <ProblemSourceReviewContent />
    </Suspense>
  );
}
