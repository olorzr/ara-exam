'use client';

import { useMemo, type ReactNode } from 'react';
import { A4Document, CompactPageHeader } from '@/components/print';
import ExamPrintHeader from '@/components/exam/ExamPrintHeader';
import { answerTag, numberPrintQaItems, qaPaperTitle, qaSourceLabels } from '@/lib/print-qa';
import type { PrintQaItem } from '@/types/print-scan';

/**
 * 학교 프린트 문답의 **답지** 인쇄 뷰.
 *
 * 번호는 문제지·교사용과 **같은 함수**(`numberPrintQaItems`)로 매긴다 — 따로 세면 문항을
 * 하나 뺐을 때 세 인쇄물이 어긋나고, 그 사실은 채점할 때에야 드러난다.
 *
 * ⚠️ 기출 정답표(`ProblemAnswerKeyView`)처럼 **한 줄에 다섯 개씩** 늘어놓지 않는다.
 *    학교 프린트의 답은 서술형이라 한 칸에 두 문장이 들어가는데, 격자에 욱여넣으면
 *    글자가 칸을 넘어 잘린다(`.a4-sheet__body` 의 `overflow:hidden` 이 인쇄에서만 자른다).
 * ⚠️ AI 가 만든 답에는 **출처와 근거를 함께 싣는다.** 채점하는 사람이 "어디에 그렇게
 *    적혀 있나" 를 바로 확인할 수 있어야 한다 — 근거를 못 찾은 답은 그 사실을 밝힌다.
 */

interface PrintQaKeyViewProps {
  /** 프린트 이름 */
  name: string;
  /** 머리말 출처에 쓸 묶음 분류 */
  bundle: { school_name: string; year: string; grade: string; semester: string; exam_type: string };
  items: PrintQaItem[];
  /** 모범답안을 만들 때 **그때** 함께 읽은 자료 이름들 (`qa_meta.references`) */
  references?: string[];
}

/**
 * 답지를 A4 쪽으로 그린다.
 * @param props - 프린트 이름·분류·문항과 참고자료 이름
 * @returns 인쇄용 문서
 */
export default function PrintQaKeyView({
  name, bundle, items, references = [],
}: PrintQaKeyViewProps) {
  const title = qaPaperTitle(name, 'key');

  const blocks = useMemo(() => {
    const out: ReactNode[] = [];
    numberPrintQaItems(items).forEach(({ item, number }, index) => {
      const tag = answerTag(item);
      const missing = item.answer.trim() === '';
      // 줄무늬는 nth-child 가 아니라 줄 인덱스로 준다 — 쪽이 갈리면 nth-child 는 리셋된다
      const band = index % 2 === 1;
      out.push(
        <div key={item.id} className={`pb-qa-key${band ? ' pb-qa-key--band' : ''}`}>
          <span className="pb-qa-key__num">{number}</span>
          <span className="pb-qa-key__value">
            <span className={missing ? 'pb-answer-value--missing' : undefined}>
              {missing ? '미입력' : item.answer}
            </span>
            {tag && (
              <span className={`pb-qa-tag${tag.check ? ' pb-qa-tag--check' : ''}`}>{tag.text}</span>
            )}
            {item.evidence && <p className="pb-quiz-evidence">{item.evidence}</p>}
          </span>
        </div>,
      );
    });
    return out;
  }, [items]);

  return (
    <A4Document
      blocks={blocks}
      columns={1}
      className="pb-sheet"
      firstPageHeader={
        <>
          <ExamPrintHeader title={title} sourceLabels={qaSourceLabels(bundle)} />
          <div className="section-bar section-bar--mint mb-2">
            <span>전체 {items.length}문항</span>
          </div>
          {references.length > 0 && (
            <p className="pb-quiz-refs">참고자료: {references.join(' · ')}</p>
          )}
        </>
      }
      laterPageHeader={<CompactPageHeader title={title} />}
    />
  );
}
