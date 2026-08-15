'use client';

import type { ExamWord, Category } from '@/types';
import { formatCategoryLabel } from '@/lib/format';
import { generateChoices } from '@/lib/exam-choices';
import { A4Document, CompactPageHeader } from '@/components/print';
import ExamPrintHeader from './ExamPrintHeader';

interface MultipleChoiceViewProps {
  exam: {
    title: string;
    pass_percentage: number;
    pass_count: number;
  };
  words: ExamWord[];
  categories: Category[];
}

/**
 * 객관식 시험지 뷰 (2단 레이아웃, 5지선다).
 * 뜻을 보여주고 해당하는 단어를 선지에서 고르는 형태.
 */
export default function MultipleChoiceView({ exam, words, categories }: MultipleChoiceViewProps) {
  const sourceLabels = categories.map((c) => formatCategoryLabel(c));
  const title = `${exam.title} - 객관식 시험지`;

  const blocks = words.map((w, idx) => {
    const choices = generateChoices(w, words, idx);
    return (
      <div key={w.id} className={`mc-q-item ${idx % 2 === 1 ? 'mc-q-item--band' : ''}`}>
        <div className="mc-q-header">
          <span className="q-num q-num--mint">{String(idx + 1).padStart(2, '0')}</span>
          <span className="mc-q-meaning">{w.meaning}</span>
        </div>
        <div className="mc-q-choices">
          {choices.map((c, ci) => (
            <span key={ci} className="mc-q-choice">
              {c.label} {c.word}
            </span>
          ))}
        </div>
      </div>
    );
  });

  return (
    <A4Document
      blocks={blocks}
      columns={2}
      remeasureKey={`${exam.title}|${words.length}`}
      firstPageHeader={
        <>
          <ExamPrintHeader
            title={title}
            sourceLabels={sourceLabels}
            passCount={exam.pass_count}
            passPercentage={exam.pass_percentage}
            showScoreRow
            totalCount={words.length}
          />
          <div className="section-bar section-bar--mint mb-2">
            <span>다음 뜻에 해당하는 단어를 고르시오.</span>
          </div>
        </>
      }
      laterPageHeader={<CompactPageHeader title={title} />}
    />
  );
}
