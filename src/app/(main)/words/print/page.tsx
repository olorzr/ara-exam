'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Category, Word } from '@/types';
import { WordBookView } from '@/components/exam';
import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { formatCategoryLabel } from '@/lib/format';

function WordsPrintContent() {
  const searchParams = useSearchParams();
  const categoryId = searchParams.get('categoryId');
  const [category, setCategory] = useState<Category | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!categoryId) return;
    async function load() {
      const [catRes, wordsRes] = await Promise.all([
        supabase.from('categories').select('*').eq('id', categoryId).single(),
        supabase.from('words').select('*').eq('category_id', categoryId).order('order_index'),
      ]);
      // 조회에 실패하거나 행이 없으면 not-found 로 전환한다.
      // (이 처리가 없으면 category 가 영원히 null 이라 스피너가 멈추지 않는다)
      if (catRes.error || !catRes.data) {
        setLoadFailed(true);
        return;
      }
      setCategory(catRes.data);
      if (wordsRes.data) {
        const sorted = [...wordsRes.data].sort((a, b) => a.word.localeCompare(b.word, 'ko'));
        setWords(sorted);
      }
    }
    load();
  }, [categoryId]);

  // categoryId 가 아예 없는 경우는 렌더 시점에 판정한다(effect 내 동기 setState 회피).
  if (!categoryId || loadFailed) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-gray-600">단어장을 찾을 수 없어요. 삭제되었거나 잘못된 주소예요.</p>
        <Link href="/words">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            단어 관리로 돌아가기
          </Button>
        </Link>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div>
      {/* 컨트롤 바 (인쇄 시 숨김) */}
      <div data-no-print className="space-y-4 mb-8">
        <div className="flex items-center gap-4">
          <Link href="/words">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              돌아가기
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">단어장</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" />
            인쇄
          </Button>
        </div>
      </div>

      {/* 인쇄 영역 */}
      <div className="print-area">
        <WordBookView
          sourceText={formatCategoryLabel(category, { excludePublisher: true })}
          words={words}
        />
      </div>
    </div>
  );
}

/**
 * 소단원별 단어장 인쇄 페이지. 카테고리 ID로 단어를 로드하여 단어장을 표시한다.
 */
export default function WordsPrintPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    }>
      <WordsPrintContent />
    </Suspense>
  );
}
