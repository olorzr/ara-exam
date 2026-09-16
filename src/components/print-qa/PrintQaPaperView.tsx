'use client';

import { useMemo, type ReactNode } from 'react';
import { A4Document, CompactPageHeader } from '@/components/print';
import ExamPrintHeader from '@/components/exam/ExamPrintHeader';
import { splitPassageBlocks } from '@/lib/passage-quiz';
import {
  answerLineCount, answerTag, numberPrintQaItems, qaPaperTitle, qaSourceLabels,
} from '@/lib/print-qa';
import type { PrintQaItem } from '@/types/print-scan';

/**
 * 학교 프린트 문답의 **문제지**와 **교사용** 인쇄 뷰.
 *
 * 두 인쇄물을 한 컴포넌트로 그리는 까닭: 다른 것은 **답을 찍느냐 답 쓸 줄을 긋느냐** 하나뿐인데
 * 따로 만들면 번호·앞글·줄 수가 조용히 갈라진다. 실제로 그렇게 갈라진 인쇄물은 채점할 때에야
 * 드러난다(`numberQuizItems` 를 문제지·정답표가 함께 쓰는 것과 같은 규약).
 *
 * ⚠️ 물음 앞의 글(`lead`)은 **문단마다 블록으로 쪼갠다** — 한 덩어리로 주면 한 쪽에 못 담을 때
 *    `A4Document` 가 통째로 축소해 글씨가 작아진다.
 * ⚠️ 그 글은 **학생 문제지에서는 선생님이 확인한 것만** 나간다(`leadApproved`). 교사용에는
 *    확인 여부와 무관하게 실어 — 선생님이 보고 판단할 거리가 거기 있어야 한다.
 * ⚠️ 답은 물음과 **같은 블록**에 둔다. 따로 내보내면 쪽이 갈릴 때 물음과 답이 다른 장에 찍힌다.
 */

interface PrintQaPaperViewProps {
  /** 프린트 이름 */
  name: string;
  /** 머리말 출처에 쓸 묶음 분류 */
  bundle: { school_name: string; year: string; grade: string; semester: string; exam_type: string };
  items: PrintQaItem[];
  /** 교사용인가 — 답 쓰는 줄 대신 **답을 찍는다** */
  showAnswers: boolean;
}

/**
 * 문제지·교사용을 A4 쪽으로 그린다.
 * @param props - 프린트 이름·분류·문항과 답 표시 여부
 * @returns 인쇄용 문서
 */
export default function PrintQaPaperView({
  name, bundle, items, showAnswers,
}: PrintQaPaperViewProps) {
  const title = qaPaperTitle(name, showAnswers ? 'teacher' : 'paper');

  const blocks = useMemo(() => {
    const out: ReactNode[] = [];
    for (const { item, number } of numberPrintQaItems(items)) {
      // ⚠️ 학생 문제지에는 **선생님이 확인한 앞글만** 싣는다(코덱스 10R). 기계가 뽑은 글이
      //    지문인지 못 옮긴 답인지는 글자로 가릴 수 없다 — 교사용에는 늘 보여 준다
      if (showAnswers || item.leadApproved) pushLead(out, item);
      out.push(
        <div key={item.id} className="pb-q">
          <div className="pb-q__head">
            <span className="q-num q-num--mint">{number}</span>
            {/* ⚠️ 물음은 **줄바꿈을 지켜** 그린다 — ①②③ 보기가 줄마다 인쇄돼 있으면
                한 줄로 붙는 순간 읽을 수가 없다(`PrintQaItem.question` 은 '줄바꿈 유지' 계약이다) */}
            <div className="pb-q__stem"><p className="pb-qa-question">{item.question}</p></div>
          </div>
          {showAnswers ? <AnswerRow item={item} /> : <WriteLines item={item} />}
        </div>,
      );
    }
    return out;
  }, [items, showAnswers]);

  return (
    <A4Document
      blocks={blocks}
      columns={1}
      className="pb-sheet"
      firstPageHeader={
        <ExamPrintHeader
          title={title}
          sourceLabels={qaSourceLabels(bundle)}
          // 교사용은 선생님이 들고 채점하는 종이다 — 이름·점수란을 그리지 않는다
          showScoreRow={!showAnswers}
          totalCount={items.length}
        />
      }
      laterPageHeader={<CompactPageHeader title={title} />}
    />
  );
}

/**
 * 물음 앞에 있던 글을 문단 블록으로 밀어 넣는다.
 * @param out - 블록 목록 (여기에 더한다)
 * @param item - 문항
 */
function pushLead(out: ReactNode[], item: PrintQaItem): void {
  if (item.lead.trim() === '') return;
  const parts = splitPassageBlocks(item.lead);
  parts.forEach((part, i) => {
    const edge = `${i === 0 ? ' pb-qa-lead--first' : ''}`
      + `${i === parts.length - 1 ? ' pb-qa-lead--last' : ''}`
      // 자리가 모자라 쪼갠 조각은 원래 이어지던 글이라 붙여 둔다(연 경계만 띄운다)
      + `${part.newParagraph && i > 0 ? ' pb-qa-lead--gap' : ''}`;
    out.push(
      <div key={`${item.id}-lead-${i}`} className={`pb-qa-lead${edge}`}>
        <p className="pb-quiz-passage">{part.text}</p>
      </div>,
    );
  });
}

/** 문제지의 답 쓰는 줄 — 답 길이에 맞춰 줄 수를 정한다 */
function WriteLines({ item }: { item: PrintQaItem }) {
  const lines = answerLineCount(item);
  return (
    <div className="pb-q__lines">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="pb-q__line" />
      ))}
    </div>
  );
}

/** 교사용의 답 줄 — 어디서 온 답인지 함께 찍는다 */
function AnswerRow({ item }: { item: PrintQaItem }) {
  const tag = answerTag(item);
  const missing = item.answer.trim() === '';
  return (
    <>
      <div className={`pb-qa-answer${missing ? ' pb-qa-answer--missing' : ''}`}>
        <span className="pb-qa-answer__label">답</span>
        {missing ? '미입력' : item.answer}
        {tag && (
          <span className={`pb-qa-tag${tag.check ? ' pb-qa-tag--check' : ''}`}>{tag.text}</span>
        )}
      </div>
      {/* 근거는 AI 답을 확인하는 자리다 — 선생님이 자료를 펴 보지 않고도 가늠할 수 있어야 한다 */}
      {item.evidence && (
        <p className="pb-quiz-evidence" style={{ marginLeft: 20 }}>{item.evidence}</p>
      )}
    </>
  );
}
