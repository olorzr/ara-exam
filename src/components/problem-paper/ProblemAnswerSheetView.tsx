'use client';

import { useMemo } from 'react';
import { A4Document, CompactPageHeader } from '@/components/print';
import ExamPrintHeader from '@/components/exam/ExamPrintHeader';
import type { PaperItemSnapshot, ProblemPaper } from '@/types/problem-bank';

/** 한 줄에 담을 문항 수 — 줄 하나가 인쇄 블록 하나다 */
const ITEMS_PER_ROW = 5;

const BUBBLES = ['①', '②', '③', '④', '⑤'];

interface ProblemAnswerSheetViewProps {
  paper: ProblemPaper;
  items: PaperItemSnapshot[];
}

/**
 * 학생이 답을 적는 답안지.
 * 객관식은 동그라미, 주관식·서술형은 빈 줄을 준다.
 */
export default function ProblemAnswerSheetView({ paper, items }: ProblemAnswerSheetViewProps) {
  const title = `${paper.title} - 답안지`;

  const blocks = useMemo(() => {
    const out = [];
    for (let i = 0; i < items.length; i += ITEMS_PER_ROW) {
      const chunk = items.slice(i, i + ITEMS_PER_ROW);
      const band = Math.floor(i / ITEMS_PER_ROW) % 2 === 1;
      out.push(
        <div key={i} className={`pb-answer-row${band ? ' pb-answer-row--band' : ''}`}>
          {chunk.map((item, j) => (
            <div key={i + j} className="pb-answer-cell">
              <span className="pb-answer-num">{i + j + 1}</span>
              {item.question_type === '객관식' ? (
                <span className="pb-omr-bubbles">
                  {BUBBLES.map((b) => <span key={b}>{b}</span>)}
                </span>
              ) : (
                <span className="pb-omr-line" />
              )}
            </div>
          ))}
        </div>,
      );
    }
    return out;
  }, [items]);

  return (
    <A4Document
      blocks={blocks}
      columns={1}
      className="pb-sheet"
      firstPageHeader={
        <ExamPrintHeader
          title={title}
          sourceLabels={paper.source_labels}
          showScoreRow
          totalCount={items.length}
        />
      }
      laterPageHeader={<CompactPageHeader title={title} />}
    />
  );
}
