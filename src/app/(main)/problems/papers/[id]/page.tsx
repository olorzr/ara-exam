'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import ProblemPaperView from '@/components/problem-paper/ProblemPaperView';
import ProblemAnswerKeyView from '@/components/problem-paper/ProblemAnswerKeyView';
import PaperCoverAlerts from '@/components/problem-paper/PaperCoverAlerts';
import PaperCoverDialog from '@/components/problem-paper/PaperCoverDialog';
import { PaperPrintLayoutNotice } from '@/components/problem-paper/PaperPrintLayoutToggle';
import PaperViewToolbar, { type PaperViewMode } from '@/components/problem-paper/PaperViewToolbar';
import { supabase } from '@/lib/supabase';
import { useImagesReady } from '@/hooks/useImagesReady';
import { usePaperCover } from '@/hooks/usePaperCover';
import { useSignedImageUrls } from '@/hooks/useSignedImageUrls';
import {
  imagePathsOf, renumberedImageItems, renumberedPrintConfirmMessage,
} from '@/lib/problem-paper/blocks';
import {
  readPaperPrintLayout, writePaperPrintLayout, type PaperPrintLayout,
} from '@/lib/problem-paper/print-layout-pref';
import { normalizePaperSettings } from '@/lib/problem-paper/settings';
import type { PaperItemSnapshot, ProblemPaper } from '@/types/problem-bank';

/** 번호 어긋남 안내를 확인하기 전에는 중철로 그리지 않는다(아래 `bookletBlocked`) */
/** 표지를 못 읽은 채 Cmd/Ctrl+P 로 뽑으면 표지 자리에 찍히는 말 */
const COVER_FETCH_FAILED_NOTICE =
  '표지를 불러오지 못했어요. 화면 위쪽에서 \'다시 시도\' 를 누르거나 \'표지 없이 인쇄\' 를 고른 뒤 다시 인쇄해 주세요.';

const BOOKLET_BLOCKED_REASON =
  '이미지 문항의 번호 어긋남 안내를 확인하면 중철 제본으로 바뀌어요. 그전에는 낱장으로 보여 줘요.';

/**
 * 저장된 문제지 보기·인쇄 (`/problems/papers/[id]`).
 *
 * 본문은 만들 때 굳힌 **스냅샷**이라 원본 문항을 고치거나 지워도 그대로 인쇄된다.
 */
export default function ProblemPaperViewPage() {
  const params = useParams<{ id: string }>();
  const paperId = params?.id ?? '';

  const [paper, setPaper] = useState<ProblemPaper | null>(null);
  const [items, setItems] = useState<PaperItemSnapshot[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<PaperViewMode>('paper');
  // 인쇄 방식은 기억해 둔 값으로 시작한다 — 효과에서 읽으면 set-state-in-effect 에 걸린다
  const [printLayout, setPrintLayout] = useState<PaperPrintLayout>(readPaperPrintLayout);
  const [coverOpen, setCoverOpen] = useState(false);
  const coverState = usePaperCover(paperId);
  const { cover } = coverState;
  /** 표지를 못 읽었지만 표지 없이 가기로 했는가 */
  const [skipCover, setSkipCover] = useState(false);
  const coverUnknown = coverState.failed && !skipCover;
  /**
   * 문항 본문을 인쇄하는 모드인가.
   *
   * ⚠️ 교사용도 **같은 본문**이라 이미지 문항과 원본 번호가 그대로 실린다 — 이미지 준비
   *    잠금·깨진 이미지 안내·번호 어긋남 확인이 문제지에만 걸리면, 교사용으로 뽑을 때
   *    그 모든 경고를 조용히 건너뛴다.
   */
  const printsProblems = mode === 'paper' || mode === 'teacher';

  // 이미지는 **페이지가 들고 있는다** — 아직 안 왔거나 실패했는지를 알아야 인쇄를 막는다.
  // 이미지로 출제한 문항은 그 이미지가 본문 전체라, 조용히 비워 인쇄하면
  // 문항이 통째로 빠진 시험지가 나간다(코덱스 리뷰 7R)
  const images = useSignedImageUrls(useMemo(() => imagePathsOf(items), [items]));
  // 서명만으로는 부족하다 — 그 뒤의 이미지 요청이 실패하면 깨진 그림이 인쇄된다
  const ready = useImagesReady(useMemo(() => [...images.urls.values()], [images.urls]));
  const brokenCount = images.missing.length + ready.failed.length;
  const imagesBlocked = images.loading || ready.loading || brokenCount > 0;
  // 이미지에는 원본 시험지의 번호가 그대로 찍혀 있다 — 자리가 바뀌면 두 번호가 함께 보인다
  const renumbered = useMemo(() => renumberedImageItems(items), [items]);

  // 표지 그림은 **따로** 서명·확인한다 — 문항 이미지와 한 묶음으로 두면 답지 모드에서도
  // 화면에 없는 문항 그림 때문에 인쇄가 막히거나 엉뚱한 경고가 뜬다
  const coverPath = cover?.kind === 'image' ? cover.imagePath : '';
  const coverImages = useSignedImageUrls(useMemo(() => (coverPath ? [coverPath] : []), [coverPath]));
  const coverImageUrl = coverPath ? coverImages.urls.get(coverPath) : undefined;
  const coverReady = useImagesReady(useMemo(() => (coverImageUrl ? [coverImageUrl] : []), [coverImageUrl]));
  // `failed` 는 앞 그림의 결과를 들고 있을 수 있어 **지금 URL** 이 실패했는지로 본다
  const coverBroken = Boolean(coverPath) && (
    coverImages.missing.length > 0
    || (Boolean(coverImageUrl) && !coverReady.loading && coverReady.failed.includes(coverImageUrl ?? ''))
  );
  // 그림 표지가 아직 안 왔거나 깨졌으면 첫 장이 빈 종이로 나간다 — 인쇄를 막는다
  // 표지를 못 읽었는데 '표지 없이' 를 고르지 않았어도 막는다 — 있는 표지가 빠진 채 나간다(코덱스 1R)
  const coverBlocked = coverState.loading || coverUnknown
    || (Boolean(coverPath) && (coverImages.loading || coverReady.loading || coverBroken));

  /**
   * 번호 어긋남을 **사람이 확인했는가.**
   *
   * ⚠️ 확인 전에는 안내가 **인쇄물에도 찍힌다**(코덱스 리뷰 3R). 확인창만 두면
   *    `Cmd/Ctrl+P` 와 브라우저 메뉴 인쇄가 그것을 통째로 건너뛰는데, 화면 안내는
   *    `data-no-print` 라 **인쇄물에 아무 표시가 없다** — 조용히 나가는 바로 그 경로다.
   *    인쇄 자체를 막지는 않는다(급할 때 뽑아 손으로 고치는 길까지 막힌다, 사용자 결정).
   */
  const [renumberAcked, setRenumberAcked] = useState(false);
  /**
   * 중철은 번호 어긋남 안내를 **확인한 뒤에만** 켠다.
   *
   * ⚠️ 그 안내는 확인 전에는 일부러 인쇄물에 찍힌다(바로 위 주석). 낱장에서는 앞에 한 장이
   *    붙을 뿐이지만 중철에서는 그 한 장 때문에 **모든 면이 한 면씩 밀려 책자 전체가 어긋난다.**
   *    확인창을 지나면 같은 커밋에서 중철로 바뀌고, 아래 효과가 그 뒤에 인쇄한다.
   */
  const bookletBlocked = printsProblems && renumbered.length > 0 && !renumberAcked;
  const booklet = printLayout === 'booklet' && !bookletBlocked;
  /** 확인창을 통과해 인쇄를 잇는 중인가 — 안내를 인쇄물에서 뺀 **뒤에** 인쇄해야 한다 */
  const printAfterAckRef = useRef(false);

  useEffect(() => {
    if (!renumberAcked || !printAfterAckRef.current) return;
    printAfterAckRef.current = false;
    window.print();
  }, [renumberAcked]);

  /**
   * 인쇄 — 번호가 어긋난 이미지 문항이 있으면 **한 번 묻는다**(코덱스 리뷰).
   * 확인하면 안내를 인쇄물에서 빼고(위 효과가) 이어서 인쇄한다.
   */
  const handlePrint = () => {
    const ask = printsProblems && !renumberAcked
      ? renumberedPrintConfirmMessage(renumbered) : null;
    if (!ask) { window.print(); return; }
    if (!window.confirm(ask)) return;
    printAfterAckRef.current = true;
    setRenumberAcked(true);
  };

  const changePrintLayout = (next: PaperPrintLayout) => {
    setPrintLayout(next);
    writePaperPrintLayout(next);
  };

  const printLabel = (() => {
    if (coverState.loading) return '표지 준비 중…';
    if (coverUnknown || coverBroken) return '표지 확인 필요';
    if (coverPath && (coverImages.loading || coverReady.loading)) return '표지 준비 중…';
    if (printsProblems && (images.loading || ready.loading)) return '이미지 준비 중…';
    return booklet ? '인쇄 (A3 중철)' : '인쇄';
  })();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [paperRes, itemRes] = await Promise.all([
          supabase.from('problem_papers').select('*').eq('id', paperId).maybeSingle(),
          supabase.from('problem_paper_items').select('order_index, snapshot')
            .eq('paper_id', paperId).order('order_index').limit(300),
        ]);
        if (!alive) return;
        if (paperRes.error) throw paperRes.error;
        if (itemRes.error) throw itemRes.error;

        const row = paperRes.data as ProblemPaper | null;
        if (row) setPaper({ ...row, settings: normalizePaperSettings(row.settings) });
        setItems(((itemRes.data ?? []) as { snapshot: PaperItemSnapshot }[]).map((r) => r.snapshot));
      } catch (e) {
        if (alive) toast.error(e instanceof Error ? e.message : '불러오지 못했어요.');
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, [paperId]);

  // ⚠️ 표지(그림 표지는 그림까지)를 다 받을 때까지 문서를 그리지 않는다 — 단추만 잠그면 그 짧은
  //    틈에 Cmd/Ctrl+P 로 뽑은 인쇄물에서 표지가 빠지거나 '불러오는 중' 이 표지로 나가고, 중철 면
  //    배정까지 한 쪽씩 밀린다(코덱스 2R·3R). 못 받았으면(깨짐) 인쇄되는 안내로 그린다
  const coverImagePending = Boolean(coverPath) && (coverImages.loading || coverReady.loading);
  if (!loaded || coverState.loading || coverImagePending) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!paper) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-gray-500">
          문제지를 찾지 못했어요.{' '}
          <Link href="/problems/papers" className="text-primary underline underline-offset-2">
            목록으로
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <PaperViewToolbar
        paper={paper}
        itemCount={items.length}
        mode={mode}
        onModeChange={setMode}
        printLayout={printLayout}
        onPrintLayoutChange={changePrintLayout}
        cover={cover}
        onCoverClick={() => setCoverOpen(true)}
        printLabel={printLabel}
        printDisabled={(printsProblems && imagesBlocked) || coverBlocked}
        onPrint={handlePrint}
      />

      {printLayout === 'booklet' && (
        <PaperPrintLayoutNotice blockedReason={bookletBlocked ? BOOKLET_BLOCKED_REASON : undefined} />
      )}

      <PaperCoverAlerts
        fetchFailed={coverUnknown}
        imageBroken={coverBroken}
        onRetryFetch={coverState.reload}
        onSkipCover={() => setSkipCover(true)}
        onRetryImage={coverImages.reload}
      />

      {printsProblems && brokenCount > 0 && (
        <div
          className="flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
          data-no-print
        >
          <AlertTriangle className="h-4 w-4" />
          <span>
            이미지 {brokenCount}개를 불러오지 못했어요. 지금 인쇄하면 그 문항이 빈칸으로 나갑니다.
          </span>
          <Button type="button" variant="outline" size="sm" onClick={images.reload}>
            다시 시도
          </Button>
        </div>
      )}

      {printsProblems && renumbered.length > 0 && (
        // ⚠️ 확인 전에는 `data-no-print` 를 붙이지 않는다 — Cmd/Ctrl+P 로 바로 뽑아도
        //    이 안내가 함께 찍혀야 번호가 어긋난 사실이 조용히 넘어가지 않는다
        <div
          className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
          data-no-print={renumberAcked ? '' : undefined}
        >
          <p className="font-semibold">이미지로 출제한 문항의 번호가 달라요.</p>
          <p className="mt-0.5">
            잘라 둔 이미지에는 원본 번호가 찍혀 있어 인쇄 번호와 함께 보입니다
            ({renumbered.slice(0, 5).map((r) => `${r.printed}번(원본 ${r.original}번)`).join(', ')}
            {renumbered.length > 5 && ` 외 ${renumbered.length - 5}개`}).
            자리를 원래 번호에 맞추거나, 검수에서 그 문항을 글로 출제하도록 바꿔 주세요.
          </p>
          {!renumberAcked && (
            <Button
              type="button" variant="outline" size="sm" className="mt-2" data-no-print
              onClick={() => setRenumberAcked(true)}
            >
              확인했어요 — 인쇄물에서 이 안내 빼기
            </Button>
          )}
        </div>
      )}

      {/* 문제지와 교사용은 같은 컴포넌트다 — 모드마다 따로 마운트되므로 A4Document 가 새로 잰다 */}
      {printsProblems && (
        <ProblemPaperView
          paper={paper} items={items} imageUrls={images.urls}
          showAnswers={mode === 'teacher'}
          booklet={booklet} cover={cover} coverImageUrl={coverImageUrl}
          coverImageFailed={coverBroken}
          coverNotice={coverUnknown ? COVER_FETCH_FAILED_NOTICE : undefined}
        />
      )}
      {mode === 'key' && (
        <ProblemAnswerKeyView
          paper={paper} items={items}
          booklet={booklet} cover={cover} coverImageUrl={coverImageUrl}
          coverImageFailed={coverBroken}
          coverNotice={coverUnknown ? COVER_FETCH_FAILED_NOTICE : undefined}
        />
      )}

      <PaperCoverDialog
        open={coverOpen}
        paperTitle={paper.title}
        cover={cover}
        coverImageUrl={coverImageUrl}
        busy={coverState.saving}
        onClose={() => setCoverOpen(false)}
        onSave={coverState.save}
        onRemove={coverState.remove}
      />
    </div>
  );
}
