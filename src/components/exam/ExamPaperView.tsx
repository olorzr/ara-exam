'use client';

import type { ExamWord, Category } from '@/types';
import { formatCategoryLabel } from '@/lib/format';
import { A4Document, CompactPageHeader } from '@/components/print';
import ExamPrintHeader from './ExamPrintHeader';

/** 단일 열 최대 문항 수 기준 */
const SINGLE_COL_THRESHOLD = 20;

interface ExamPaperViewProps {
  exam: {
    title: string;
    pass_percentage: number;
    pass_count: number;
  };
  words: ExamWord[];
  categories: Category[];
  showAnswer: boolean;
}

/**
 * 시험지 / 답안지 뷰 (민트 테마).
 * 문항 하나가 페이지네이션 블록 하나라 페이지 경계에서 문항이 잘리지 않는다.
 */
export default function ExamPaperView({ exam, words, categories, showAnswer }: ExamPaperViewProps) {
  const useSingleCol = words.length <= SINGLE_COL_THRESHOLD;
  const sourceLabels = categories.map((c) => formatCategoryLabel(c));
  const title = showAnswer ? `${exam.title} - 주관식 답안지` : `${exam.title} - 주관식 시험지`;

  const blocks = words.map((w, idx) => (
    <div key={w.id} className={`q-row ${idx % 2 === 1 ? 'q-row--band' : ''}`}>
      <span className="q-num q-num--mint">{String(idx + 1).padStart(2, '0')}</span>
      <span className="q-text">{w.meaning}</span>
      {showAnswer ? <span className="q-answer">{w.word}</span> : <span className="q-blank" />}
    </div>
  ));

  return (
    <A4Document
      blocks={blocks}
      columns={useSingleCol ? 1 : 2}
      remeasureKey={`${exam.title}|${words.length}|${showAnswer}`}
      firstPageHeader={
        <>
          <ExamPrintHeader
            title={title}
            sourceLabels={sourceLabels}
            passCount={exam.pass_count}
            passPercentage={exam.pass_percentage}
            showScoreRow={!showAnswer}
            totalCount={words.length}
          />
          <div className="section-bar section-bar--mint mb-2">
            <span>다음 뜻에 해당하는 단어를 쓰시오.</span>
          </div>
        </>
      }
      laterPageHeader={<CompactPageHeader title={title} />}
    />
  );
}
