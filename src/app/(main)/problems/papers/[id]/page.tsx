'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { imagePathsOf, renumberedImageItems } from '@/lib/problem-paper/blocks';
import { normalizePaperSettings } from '@/lib/problem-paper/settings';
import type { PaperItemSnapshot, ProblemPaper } from '@/types/problem-bank';

type ViewMode = 'paper' | 'key' | 'sheet';

const VIEW_LABELS: { mode: ViewMode; label: string }[] = [
  { mode: 'paper', label: '문제지' },
  { mode: 'key', label: '정답표' },
  { mode: 'sheet', label: '답안지' },
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
            onClick={() => window.print()}
            disabled={mode === 'paper' && imagesBlocked}
          >
            <Printer className="h-3.5 w-3.5" />
            <span className="ml-1">
              {mode === 'paper' && (images.loading || ready.loading) ? '이미지 준비 중…' : '인쇄'}
            </span>
          </Button>
        </div>
      </div>

      {mode === 'paper' && brokenCount > 0 && (
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

      {mode === 'paper' && renumbered.length > 0 && (
        <div
          className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
          data-no-print
        >
          <p className="font-semibold">이미지로 출제한 문항의 번호가 달라요.</p>
          <p className="mt-0.5">
            잘라 둔 이미지에는 원본 번호가 찍혀 있어 인쇄 번호와 함께 보입니다
            ({renumbered.slice(0, 5).map((r) => `${r.printed}번(원본 ${r.original}번)`).join(', ')}
            {renumbered.length > 5 && ` 외 ${renumbered.length - 5}개`}).
            자리를 원래 번호에 맞추거나, 검수에서 그 문항을 글로 출제하도록 바꿔 주세요.
          </p>
        </div>
      )}

      {mode === 'paper' && <ProblemPaperView paper={paper} items={items} imageUrls={images.urls} />}
      {mode === 'key' && <ProblemAnswerKeyView paper={paper} items={items} />}
      {mode === 'sheet' && <ProblemAnswerSheetView paper={paper} items={items} />}
    </div>
  );
}
