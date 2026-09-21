'use client';

import type { ExamWord, Category } from '@/types';
import { formatCategoryLabel } from '@/lib/format';
import { generateChoices } from '@/lib/exam-choices';
import { OMR_SHEET_QUESTIONS, omrSheetCount, omrSlotLabel, startsNewOmrSheet } from '@/lib/omr-sheet';
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
 *
 * 90문항이 넘으면 학생이 90A 답안지를 **여러 장** 쓴다. 기성 용지라 장 번호를 인쇄로 표시할 수
 * 없으므로, 시험지 쪽에서 구분 줄과 보조 표기(`2-1` = 2장째 1번 칸)로 알린다.
 */
export default function MultipleChoiceView({ exam, words, categories }: MultipleChoiceViewProps) {
  const sourceLabels = categories.map((c) => formatCategoryLabel(c));
  const title = `${exam.title} - 객관식 시험지`;

  const sheetCount = omrSheetCount(words.length);
  const multiSheet = sheetCount > 1;

  const blocks = words.flatMap((w, idx) => {
    const choices = generateChoices(w, words, idx);
    const item = (
      <div key={w.id} className={`mc-q-item ${idx % 2 === 1 ? 'mc-q-item--band' : ''}`}>
        <div className="mc-q-header">
          <span className="q-num q-num--mint">{String(idx + 1).padStart(2, '0')}</span>
          {multiSheet && <span className="mc-q-slot">{omrSlotLabel(idx)}</span>}
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

    // 새 답안지가 시작되는 문항 **앞**에 구분 줄을 끼운다.
    // ⚠️ 줄과 그 문항을 **한 블록으로 묶는다**. 따로 내보내면 인쇄 엔진이 각각 배치해,
    //   자리가 모자랄 때 '답안지 2장째' 안내만 앞 단 바닥에 남고 91번은 다음 쪽에서 시작한다.
    if (!multiSheet || !startsNewOmrSheet(idx)) return [item];
    const sheetNo = idx / OMR_SHEET_QUESTIONS + 1;
    return [
      <div key={`omr-sheet-${sheetNo}`}>
        <div className="section-bar section-bar--mint mc-sheet-break">
          <span>
            여기부터 답안지 {sheetNo}장째 — 새 답안지의 1번 칸부터 표시하세요
          </span>
        </div>
        {item}
      </div>,
    ];
  });

  return (
    <A4Document
      blocks={blocks}
      columns={2}
      firstPageHeader={
        <>
          <ExamPrintHeader
            title={title}
            sourceLabels={sourceLabels}
            passCount={exam.pass_count}
            passPercentage={exam.pass_percentage}
            showScoreRow
            totalCount={words.length}
            answerSheetCount={sheetCount}
          />
          <div className="section-bar section-bar--mint mb-2">
            <span>
              다음 뜻에 해당하는 단어를 고르시오.
              {multiSheet && ' 문항 번호 옆의 작은 숫자는 (답안지 장 - 칸 번호) 입니다.'}
            </span>
          </div>
        </>
      }
      laterPageHeader={<CompactPageHeader title={title} />}
    />
  );
}
