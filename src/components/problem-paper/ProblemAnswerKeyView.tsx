'use client';

import { useMemo, type ReactNode } from 'react';
import { A4Document, CompactPageHeader } from '@/components/print';
import ExamPrintHeader from '@/components/exam/ExamPrintHeader';
import {
  buildAnswerRows, explanationEntries, MISSING_ANSWER_LABEL,
} from '@/lib/problem-paper/answers';
import type { PaperItemSnapshot, ProblemPaper } from '@/types/problem-bank';

/** 한 줄에 담을 문항 수 — 줄 하나가 인쇄 블록 하나다(쪽이 갈려도 줄은 안 쪼개진다) */
const ITEMS_PER_ROW = 5;

interface ProblemAnswerKeyViewProps {
  paper: ProblemPaper;
  items: PaperItemSnapshot[];
}

/**
 * 답지 — **빠른 정답이 먼저**, 그 아래 해설.
 *
 * 차례가 규약이다(2026-09-20, 사용자 결정): 채점은 거의 언제나 번호와 답만 있으면 되고
 * 해설은 틀린 문항을 짚을 때에야 편다. 해설을 위에 두면 채점할 때마다 답을 찾아 몇 쪽을
 * 넘겨야 한다.
 *
 * 정답이 비어 있으면 빈칸이 아니라 **'미입력'** 이라고 찍는다 —
 * 빈칸으로 두면 인쇄물에서 "정답이 없는 문항"과 "인쇄가 빠진 것"을 구분할 수 없다.
 */
export default function ProblemAnswerKeyView({ paper, items }: ProblemAnswerKeyViewProps) {
  const title = `${paper.title} - 답지`;
  const rows = useMemo(() => buildAnswerRows(items), [items]);
  const explanations = useMemo(() => explanationEntries(items), [items]);

  const blocks = useMemo(() => {
    const out: ReactNode[] = [];

    for (let i = 0; i < rows.length; i += ITEMS_PER_ROW) {
      const chunk = rows.slice(i, i + ITEMS_PER_ROW);
      const band = Math.floor(i / ITEMS_PER_ROW) % 2 === 1;
      out.push(
        // 줄무늬는 nth-child 가 아니라 줄 인덱스로 준다 — 쪽이 갈리면 nth-child 는 리셋된다
        <div key={`row-${i}`} className={`pb-answer-row${band ? ' pb-answer-row--band' : ''}`}>
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
            </div>
          ))}
        </div>,
      );
    }

    // ⚠️ 해설이 하나도 없으면 제목 줄도 내지 않는다 — 기출은 해설이 안 달린 문항이 흔해서,
    //    빈 '해설' 띠만 찍히면 "해설이 인쇄에서 빠졌나" 로 읽힌다
    explanations.forEach((entry, i) => {
      out.push(
        // 해설 한 덩어리가 한 블록 — 번호·정답·본문이 갈리면 어느 문항 것인지 알 수 없다.
        // ⚠️ '해설' 제목은 **첫 해설과 같은 블록**이다. 따로 내보내면 쪽·단 끝에 제목만
        //    혼자 남을 수 있는데, 그러면 다음 장 첫머리에 제목 없이 해설이 시작된다
        <div key={`exp-${entry.number}`}>
          {i === 0 && (
            <div className="section-bar section-bar--mint">
              <span>해설</span>
            </div>
          )}
          <div className="pb-key-exp">
            <span className="pb-answer-num">{entry.number}</span>
            <div className="pb-key-exp__body">
              <span className="pb-key-exp__answer">정답 {entry.answer}</span>
              <div
                // `explanationEntries` 가 정화한 값만 담아 준다 — 여기서 또 하지 않는다
                dangerouslySetInnerHTML={{ __html: entry.explanation_html }}
              />
            </div>
          </div>
        </div>,
      );
    });

    return out;
  }, [rows, explanations]);

  return (
    <A4Document
      blocks={blocks}
      columns={1}
      className="pb-sheet"
      firstPageHeader={
        <>
          {/* 머리글 출처 줄은 기출 인쇄물 셋이 함께 뺐다(ProblemPaperView 참고) */}
          <ExamPrintHeader title={title} />
          <div className="section-bar section-bar--mint mb-2">
            <span>빠른 정답 · 전체 {items.length}문항</span>
          </div>
        </>
      }
      laterPageHeader={<CompactPageHeader title={title} />}
    />
  );
}
