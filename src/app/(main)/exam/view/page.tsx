'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { ExamWord, Category } from '@/types';
import { formatCategoryLabel } from '@/lib/format';
import { checkExamWords, examWordsIssueMessage, type ExamWordsIssue } from '@/lib/exam-words-check';
import { MAX_EXAM_WORDS } from '@/lib/words-fetch';
import { ExamPaperView, MultipleChoiceView, MultipleChoiceAnswerView, WordBookView } from '@/components/exam';
import { Button } from '@/components/ui/button';
import { Printer, FileText, ArrowLeft, AlertTriangle } from 'lucide-react';
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
  /** 시험을 못 읽은 까닭 — 없는 시험(`not_found`)과 읽기 실패(`failed`)는 할 일이 다르다 */
  const [loadError, setLoadError] = useState<'not_found' | 'failed' | null>(null);
  /**
   * 문항 스냅샷을 믿을 수 없는 까닭(2026-10-15 리뷰 6번) — 있으면 시험지·선지·정답을 **만들지 않고**
   * 인쇄도 막는다. 문항 조회 실패를 빈 목록으로 바꾸면 빈 시험지가 정상처럼 인쇄된다.
   */
  const [wordsIssue, setWordsIssue] = useState<ExamWordsIssue | null>(null);
  /** '다시 시도' 세대 */
  const [attempt, setAttempt] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [viewMode, setViewMode] = useState<'exam' | 'answer' | 'mc-exam' | 'mc-answer' | 'wordbook'>('exam');
  const notFound = !examId || loadError === 'not_found';

  useEffect(() => {
    if (!examId) return;
    let alive = true;
    async function load() {
      // 네트워크 예외(throw)가 나도 스피너가 멈추도록 finally 에서 loading 을 내린다.
      try {
        const [examRes, wordsRes] = await Promise.all([
          supabase.from('exams').select('*').eq('id', examId).maybeSingle(),
          // ⚠️ 상한(1,000)까지 한 번에 받는다 — 넘는 시험은 개수 불일치로 걸려 인쇄가 막힌다.
          //    `id` 를 붙여 순서를 하나로 정한다(같은 순서 번호가 섞여도 화면마다 달라지지 않게)
          supabase.from('exam_words').select('*').eq('exam_id', examId)
            .order('order_index').order('id').range(0, MAX_EXAM_WORDS - 1),
        ]);
        if (!alive) return;
        if (examRes.error) {
          setLoadError('failed');
          return;
        }
        if (!examRes.data) {
          setLoadError('not_found');
          return;
        }
        const examRow = examRes.data as ExamData;
        const rows = wordsRes.error ? [] : ((wordsRes.data ?? []) as ExamWord[]);
        setExam(examRow);
        setExamWords(rows);
        // 조회 실패와 '정상 0건' 을 가른다 — 실패를 빈 목록으로 두면 빈 시험지가 인쇄된다
        setWordsIssue(wordsRes.error ? { kind: 'failed' } : checkExamWords(examRow.total_questions, rows));

        // 카테고리 출처 정보 로드
        if (examRow.category_ids?.length) {
          const catRes = await supabase
            .from('categories')
            .select('*')
            .in('id', examRow.category_ids);
          if (alive && catRes.data) setCategories(catRes.data);
        }
      } catch {
        if (alive) setLoadError('failed');
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [examId, attempt]);

  /** 시험·문항을 처음부터 다시 읽는다 */
  const retry = () => {
    setLoading(true);
    setLoadError(null);
    setWordsIssue(null);
    setAttempt((n) => n + 1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (loadError === 'failed') {
    return (
      <div className="text-center py-20" role="alert">
        <p className="text-sm text-gray-500 font-medium">시험지를 불러오지 못했어요</p>
        <p className="text-xs text-gray-400 mt-1">잠시 후 다시 시도해 주세요.</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="outline" onClick={retry}>다시 시도</Button>
          <Link href="/exam/history">
            <Button variant="ghost">시험지 목록으로</Button>
          </Link>
        </div>
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
        {/* ⚠️ 문항을 믿을 수 없으면 보기·인쇄 단추 대신 안내와 다시 시도만 둔다 */}
        {wordsIssue ? (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
          >
            <AlertTriangle className="h-4 w-4" aria-hidden />
            <span>{examWordsIssueMessage(wordsIssue)}</span>
            <Button type="button" variant="outline" size="sm" onClick={retry}>다시 시도</Button>
          </div>
        ) : (
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
        )}
      </div>

      {/* 인쇄 영역 — 문항을 믿을 수 없으면 아무것도 그리지 않는다(Cmd/Ctrl+P 로 빈 종이만 나간다) */}
      {!wordsIssue && (
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
      )}
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
