'use client';

import { useMemo } from 'react';
import { A4Document, CompactPageHeader } from '@/components/print';
import ExamPrintHeader from '@/components/exam/ExamPrintHeader';
import { buildAnswerRows, MISSING_ANSWER_LABEL, totalScore } from '@/lib/problem-paper/blocks';
import type { PaperItemSnapshot, ProblemPaper } from '@/types/problem-bank';

/** 한 줄에 담을 문항 수 — 답안지와 같은 규약(줄 하나가 인쇄 블록 하나) */
const ITEMS_PER_ROW = 5;

interface ProblemAnswerKeyViewProps {
  paper: ProblemPaper;
  items: PaperItemSnapshot[];
}

/**
 * 정답표.
 *
 * 정답이 비어 있으면 빈칸이 아니라 **'미입력'** 이라고 찍는다 —
 * 빈칸으로 두면 인쇄물에서 "정답이 없는 문항"과 "인쇄가 빠진 것"을 구분할 수 없다.
 */
export default function ProblemAnswerKeyView({ paper, items }: ProblemAnswerKeyViewProps) {
  const title = `${paper.title} - 정답표`;
  const rows = useMemo(() => buildAnswerRows(items), [items]);
  const total = useMemo(() => totalScore(items), [items]);

  const blocks = useMemo(() => {
    const out = [];
    for (let i = 0; i < rows.length; i += ITEMS_PER_ROW) {
      const chunk = rows.slice(i, i + ITEMS_PER_ROW);
      const band = Math.floor(i / ITEMS_PER_ROW) % 2 === 1;
      out.push(
        // 줄무늬는 nth-child 가 아니라 줄 인덱스로 준다 — 쪽이 갈리면 nth-child 는 리셋된다
        <div key={i} className={`pb-answer-row${band ? ' pb-answer-row--band' : ''}`}>
          {chunk.map((row) => (
            <div key={row.number} className="pb-answer-cell">
              <span className="pb-answer-num">{row.number}</span>
              <span
                className={`pb-answer-value${
                  row.answer === MISSING_ANSWER_LABEL ? ' pb-answer-value--missing' : ''
                }`}
              >
                {row.answer}
              </span>
              {row.score !== null && <span className="pb-answer-score">{row.score}점</span>}
            </div>
          ))}
        </div>,
      );
    }
    return out;
  }, [rows]);

  return (
    <A4Document
      blocks={blocks}
      columns={1}
      className="pb-sheet"
      firstPageHeader={
        <>
          <ExamPrintHeader title={title} sourceLabels={paper.source_labels} />
          <div className="section-bar section-bar--mint mb-2">
            <span>
              전체 {items.length}문항
              {total !== null && ` · 만점 ${total}점`}
            </span>
          </div>
        </>
      }
      laterPageHeader={<CompactPageHeader title={title} />}
    />
  );
}
