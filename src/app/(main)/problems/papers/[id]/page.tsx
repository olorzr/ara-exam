'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import ProblemPaperView from '@/components/problem-paper/ProblemPaperView';
import ProblemAnswerKeyView from '@/components/problem-paper/ProblemAnswerKeyView';
import ProblemAnswerSheetView from '@/components/problem-paper/ProblemAnswerSheetView';
import { supabase } from '@/lib/supabase';
import { useImagesReady } from '@/hooks/useImagesReady';
import { useSignedImageUrls } from '@/hooks/useSignedImageUrls';
import {
  imagePathsOf, renumberedImageItems, renumberedPrintConfirmMessage,
} from '@/lib/problem-paper/blocks';
import { normalizePaperSettings } from '@/lib/problem-paper/settings';
import type { PaperItemSnapshot, ProblemPaper } from '@/types/problem-bank';

type ViewMode = 'paper' | 'teacher' | 'key' | 'sheet';

const VIEW_LABELS: { mode: ViewMode; label: string }[] = [
  { mode: 'paper', label: '문제지' },
  { mode: 'teacher', label: '교사용' },
  { mode: 'key', label: '답지' },
  // 학생이 답을 옮겨 적는 종이. '답지' 와 헷갈리지 않게 OMR 을 앞에 붙인다
  { mode: 'sheet', label: 'OMR 답안지' },
];

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
  const [mode, setMode] = useState<ViewMode>('paper');
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

  /**
   * 번호 어긋남을 **사람이 확인했는가.**
   *
   * ⚠️ 확인 전에는 안내가 **인쇄물에도 찍힌다**(코덱스 리뷰 3R). 확인창만 두면
   *    `Cmd/Ctrl+P` 와 브라우저 메뉴 인쇄가 그것을 통째로 건너뛰는데, 화면 안내는
   *    `data-no-print` 라 **인쇄물에 아무 표시가 없다** — 조용히 나가는 바로 그 경로다.
   *    인쇄 자체를 막지는 않는다(급할 때 뽑아 손으로 고치는 길까지 막힌다, 사용자 결정).
   */
  const [renumberAcked, setRenumberAcked] = useState(false);
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

  if (!loaded) {
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
      <div className="flex flex-wrap items-center gap-2" data-no-print>
        <Link
          href="/problems/papers"
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" /> 목록
        </Link>
        <span className="ml-2 font-semibold text-gray-900">{paper.title}</span>
        <span className="text-sm text-gray-500">{items.length}문항</span>

        <div className="ml-auto flex items-center gap-1">
          {VIEW_LABELS.map((v) => (
            <Button
              key={v.mode} type="button" size="sm"
              variant={mode === v.mode ? 'default' : 'outline'}
              onClick={() => setMode(v.mode)}
            >
              {v.label}
            </Button>
          ))}
          <Button
            type="button" size="sm"
            onClick={handlePrint}
            disabled={printsProblems && imagesBlocked}
          >
            <Printer className="h-3.5 w-3.5" />
            <span className="ml-1">
              {printsProblems && (images.loading || ready.loading) ? '이미지 준비 중…' : '인쇄'}
            </span>
          </Button>
        </div>
      </div>

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
        />
      )}
      {mode === 'key' && <ProblemAnswerKeyView paper={paper} items={items} />}
      {mode === 'sheet' && <ProblemAnswerSheetView paper={paper} items={items} />}
    </div>
  );
}
