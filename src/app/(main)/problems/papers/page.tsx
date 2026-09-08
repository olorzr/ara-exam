'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import type { ProblemPaper } from '@/types/problem-bank';

/**
 * 만든 문제지 목록 (`/problems/papers`).
 */
export default function ProblemPapersPage() {
  const [papers, setPapers] = useState<ProblemPaper[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase
      .from('problem_papers')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) toast.error(error.message);
        else setPapers((data ?? []) as ProblemPaper[]);
        setLoaded(true);
      });
    return () => { alive = false; };
  }, []);

  const remove = async (id: string) => {
    if (!window.confirm('이 문제지를 지울까요? 담긴 문항은 아카이브에 그대로 남아요.')) return;
    const { error } = await supabase.from('problem_papers').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPapers((list) => list.filter((p) => p.id !== id));
    toast.success('문제지를 지웠어요.');
  };

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

      {!loaded ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : papers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-gray-500">
            아직 만든 문제지가 없어요.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {papers.map((paper) => (
            <div
              key={paper.id}
              className="flex items-center gap-3 rounded-lg border border-gray-200 p-4"
            >
              <Link href={`/problems/papers/${paper.id}`} className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900">{paper.title}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {paper.total_questions}문항
                  {paper.source_labels.length > 0 && ` · ${paper.source_labels.join(', ')}`}
                  {' · '}
                  {new Date(paper.created_at).toLocaleDateString('ko-KR')}
                </p>
              </Link>
              <button
                type="button"
                onClick={() => remove(paper.id)}
                className="shrink-0 rounded p-2 text-gray-400 hover:bg-gray-100"
                aria-label={`${paper.title} 지우기`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
