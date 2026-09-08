'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import ProblemPaperView from '@/components/problem-paper/ProblemPaperView';
import ProblemAnswerKeyView from '@/components/problem-paper/ProblemAnswerKeyView';
import ProblemAnswerSheetView from '@/components/problem-paper/ProblemAnswerSheetView';
import { supabase } from '@/lib/supabase';
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
          <Button type="button" size="sm" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" /><span className="ml-1">인쇄</span>
          </Button>
        </div>
      </div>

      {mode === 'paper' && <ProblemPaperView paper={paper} items={items} />}
      {mode === 'key' && <ProblemAnswerKeyView paper={paper} items={items} />}
      {mode === 'sheet' && <ProblemAnswerSheetView paper={paper} items={items} />}
    </div>
  );
}
