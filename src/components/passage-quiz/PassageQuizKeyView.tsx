'use client';

import { useMemo, type ReactNode } from 'react';
import { A4Document, CompactPageHeader } from '@/components/print';
import ExamPrintHeader from '@/components/exam/ExamPrintHeader';
import {
  QUIZ_KEY_ITEMS_PER_ROW, numberQuizItems, quizPaperTitle, type QuizItem,
} from '@/lib/passage-quiz';

/**
 * 지문으로 만든 문항의 **정답표** 인쇄 뷰.
 *
 * 번호는 문제지와 **같은 함수**(`numberQuizItems`)로 매긴다 — 따로 세면 문항을 하나 뺐을 때
 * 두 인쇄물이 어긋나고, 그것은 채점할 때에야 드러난다.
 * 정답 아래에 **근거**를 함께 싣는다. AI 가 만든 문항이라 채점하는 사람이
 * "어디에 그렇게 적혀 있나" 를 바로 확인할 수 있어야 한다.
 *
 * ⚠️ 참고자료에서 온 근거에는 **어느 자료인지 함께 찍는다.** 안 찍으면 지문을 아무리 훑어도
 *    없는 구절을 찾게 된다. 자료 이름은 **만들 때 굳혀 둔 값**이라 나중에 목록을 바꿔도
 *    이미 인쇄한 정답표와 어긋나지 않는다.
 */

interface PassageQuizKeyViewProps {
  title: string;
  items: QuizItem[];
  /** 이 문항들을 만들 때 함께 읽은 자료 이름들 */
  references?: string[];
}

/**
 * 정답표를 A4 쪽으로 그린다.
 * @param props - 제목·문항 목록·참고자료 이름
 * @returns 인쇄용 문서
 */
export default function PassageQuizKeyView({
  title, items, references = [],
}: PassageQuizKeyViewProps) {
  const keyTitle = `${quizPaperTitle(title)} - 정답표`;

  const blocks = useMemo(() => {
    const numbered = numberQuizItems(items);
    const out: ReactNode[] = [];

    for (let i = 0; i < numbered.length; i += QUIZ_KEY_ITEMS_PER_ROW) {
      const chunk = numbered.slice(i, i + QUIZ_KEY_ITEMS_PER_ROW);
      // 줄무늬는 nth-child 가 아니라 줄 인덱스로 준다 — 쪽이 갈리면 nth-child 는 리셋된다
      const band = Math.floor(i / QUIZ_KEY_ITEMS_PER_ROW) % 2 === 1;
      out.push(
        <div key={`row-${i}`} className={`pb-answer-row${band ? ' pb-answer-row--band' : ''}`}>
          {chunk.map(({ item, number }) => (
            <div key={item.id} className="pb-answer-cell">
              <span className="pb-answer-num">{number}</span>
              <span className="pb-answer-value">{item.answer.trim() || '미입력'}</span>
            </div>
          ))}
        </div>,
      );
    }

    const withEvidence = numbered.filter(({ item }) => item.evidence.trim());
    if (withEvidence.length > 0) {
      out.push(
        <div key="evidence-bar" className="section-bar section-bar--mint">
          <span>근거</span>
        </div>,
      );
      withEvidence.forEach(({ item, number }) => out.push(
        <p key={`evidence-${item.id}`} className="pb-quiz-evidence">
          {number}. {item.evidence}
          {item.source && <span className="pb-quiz-evidence-src">[{item.source}]</span>}
        </p>,
      ));
    }

    return out;
  }, [items]);

  return (
    <A4Document
      blocks={blocks}
      columns={1}
      className="pb-sheet"
      firstPageHeader={
        <>
          <ExamPrintHeader title={keyTitle} sourceLabels={[]} />
          <div className="section-bar section-bar--mint mb-2">
            <span>전체 {items.length}문항</span>
          </div>
          {references.length > 0 && (
            <p className="pb-quiz-refs">참고자료: {references.join(' · ')}</p>
          )}
        </>
      }
      laterPageHeader={<CompactPageHeader title={keyTitle} />}
    />
  );
}
