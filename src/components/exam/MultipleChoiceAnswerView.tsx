'use client';

import type { ExamWord, Category } from '@/types';
import { formatCategoryLabel } from '@/lib/format';
import { getCorrectLabel } from '@/lib/exam-choices';
import { A4Document, CompactPageHeader } from '@/components/print';
import ExamPrintHeader from './ExamPrintHeader';

/** 답안 한 줄에 들어가는 문항 수 */
const ITEMS_PER_ROW = 5;

interface MultipleChoiceAnswerViewProps {
  exam: {
    title: string;
    pass_percentage: number;
    pass_count: number;
  };
  words: ExamWord[];
  categories: Category[];
}

/**
 * 객관식 답안지 뷰.
 * 5문항씩 한 줄로 묶어 페이지 경계에서 줄이 잘리지 않게 한다.
 */
export default function MultipleChoiceAnswerView({ exam, words, categories }: MultipleChoiceAnswerViewProps) {
  const sourceLabels = categories.map((c) => formatCategoryLabel(c));
  const title = `${exam.title} - 객관식 답안지`;

  const rows: ExamWord[][] = [];
  for (let i = 0; i < words.length; i += ITEMS_PER_ROW) {
    rows.push(words.slice(i, i + ITEMS_PER_ROW));
  }

  const blocks = rows.map((row, rowIdx) => (
    <div key={row[0]?.id ?? rowIdx} className={`mc-answer-grid ${rowIdx % 2 === 0 ? 'mc-answer-grid--band' : ''}`}>
      {row.map((w, i) => {
        const idx = rowIdx * ITEMS_PER_ROW + i;
        return (
          <div key={w.id} className="mc-answer-item">
            <span className="mc-answer-num">{String(idx + 1).padStart(2, '0')}</span>
            <span className="mc-answer-label">{getCorrectLabel(w, words, idx)}</span>
          </div>
        );
      })}
    </div>
  ));

  return (
    <A4Document
      blocks={blocks}
      columns={1}
      firstPageHeader={
        <ExamPrintHeader
          title={title}
          sourceLabels={sourceLabels}
          passCount={exam.pass_count}
          passPercentage={exam.pass_percentage}
        />
      }
      laterPageHeader={<CompactPageHeader title={title} />}
    />
  );
}
