'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { ExamWord, Category } from '@/types';
import { formatCategoryLabel } from '@/lib/format';
import { ExamPaperView, MultipleChoiceView, MultipleChoiceAnswerView, WordBookView } from '@/components/exam';
import { Button } from '@/components/ui/button';
import { Printer, FileText, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface ExamData {
  id: string;
  title: string;
  pass_percentage: number;
  total_questions: number;
  pass_count: number;
  category_ids: string[];
  created_at: string;
}

function ExamViewContent() {
  const searchParams = useSearchParams();
  const examId = searchParams.get('id');
  const [exam, setExam] = useState<ExamData | null>(null);
  const [examWords, setExamWords] = useState<ExamWord[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  // examId 가 없는 경우는 effect 안에서 setState 하지 않고 렌더 단계 파생값으로 처리한다
  // (react-hooks/set-state-in-effect 회피 + 불필요한 추가 렌더 제거).
  const [loading, setLoading] = useState(Boolean(examId));
  const [loadFailed, setLoadFailed] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [viewMode, setViewMode] = useState<'exam' | 'answer' | 'mc-exam' | 'mc-answer' | 'wordbook'>('exam');
  const notFound = !examId || loadFailed;

  useEffect(() => {
    if (!examId) return;
    async function load() {
      // 네트워크 예외(throw)가 나도 스피너가 멈추도록 finally 에서 loading 을 내린다.
      try {
        const [examRes, wordsRes] = await Promise.all([
          supabase.from('exams').select('*').eq('id', examId).single(),
          supabase.from('exam_words').select('*').eq('exam_id', examId).order('order_index'),
        ]);
        if (examRes.error || !examRes.data) {
          setLoadFailed(true);
          return;
        }
        setExam(examRes.data);
        setExamWords(wordsRes.data ?? []);

        // 카테고리 출처 정보 로드
        if (examRes.data.category_ids?.length) {
          const catRes = await supabase
            .from('categories')
            .select('*')
            .in('id', examRes.data.category_ids);
          if (catRes.data) setCategories(catRes.data);
        }
      } catch {
        setLoadFailed(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [examId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (notFound || !exam) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">-</div>
        <p className="text-sm text-gray-500 font-medium">시험지를 찾을 수 없어요</p>
        <p className="text-xs text-gray-400 mt-1">삭제되었거나 잘못된 주소일 수 있어요.</p>
        <Link href="/exam/history">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-1" />
            시험지 목록으로
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* 컨트롤 바 (인쇄 시 숨김) */}
      <div data-no-print className="space-y-4 mb-8">
        <div className="flex items-center gap-4">
          <Link href="/exam/history">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              돌아가기
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{exam.title}</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={viewMode === 'exam' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setViewMode('exam'); setShowAnswer(false); }}
            className={viewMode === 'exam' ? 'bg-primary hover:bg-primary-hover text-white' : ''}
          >
            <FileText className="h-4 w-4 mr-1" />
            주관식 시험지
          </Button>
          <Button
            variant={viewMode === 'answer' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setViewMode('answer'); setShowAnswer(true); }}
            className={viewMode === 'answer' ? 'bg-primary hover:bg-primary-hover text-white' : ''}
          >
            주관식 답안지
          </Button>
          <Button
            variant={viewMode === 'mc-exam' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setViewMode('mc-exam'); setShowAnswer(false); }}
            className={viewMode === 'mc-exam' ? 'bg-primary hover:bg-primary-hover text-white' : ''}
          >
            객관식 시험지
          </Button>
          <Button
            variant={viewMode === 'mc-answer' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setViewMode('mc-answer'); setShowAnswer(false); }}
            className={viewMode === 'mc-answer' ? 'bg-primary hover:bg-primary-hover text-white' : ''}
          >
            객관식 답안지
          </Button>
          <Button
            variant={viewMode === 'wordbook' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setViewMode('wordbook'); setShowAnswer(false); }}
            className={viewMode === 'wordbook' ? 'bg-primary hover:bg-primary-hover text-white' : ''}
          >
            단어장
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" />
            인쇄
          </Button>
        </div>
      </div>

      {/* 인쇄 영역 */}
      <div className="a4-page-bg">
        {viewMode === 'wordbook' && (
          <WordBookView
            sourceText={categories.map(c => formatCategoryLabel(c, { excludePublisher: true })).join(', ')}
            words={examWords}
          />
        )}
        {(viewMode === 'exam' || viewMode === 'answer') && (
          <ExamPaperView exam={exam} words={examWords} categories={categories} showAnswer={showAnswer} />
        )}
        {viewMode === 'mc-exam' && (
          <MultipleChoiceView exam={exam} words={examWords} categories={categories} />
        )}
        {viewMode === 'mc-answer' && (
          <MultipleChoiceAnswerView exam={exam} words={examWords} categories={categories} />
        )}
      </div>
    </div>
  );
}

/**
 * 시험지 보기 페이지. 시험지/답안지/단어장 3종 보기 및 A4 인쇄를 지원한다.
 */
export default function ExamViewPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    }>
      <ExamViewContent />
    </Suspense>
  );
}
