'use client';

import { useMemo } from 'react';
import { A4Document, CompactPageHeader } from '@/components/print';
import ExamPrintHeader from '@/components/exam/ExamPrintHeader';
import { buildAnswerRows, explanationEntries } from '@/lib/problem-paper/answers';
import type { PaperCover } from '@/lib/problem-paper/cover';
import { coverYearOf } from '@/lib/problem-paper/cover-text';
import type { PaperItemSnapshot, ProblemPaper } from '@/types/problem-bank';
import { renderAnswerKeyBlocks } from './AnswerKeyBlocks';
import { renderCoverSlots, type CoverSlotImages } from './PaperCoverPage';

interface ProblemAnswerKeyViewProps {
  paper: ProblemPaper;
  items: PaperItemSnapshot[];
  /** 중철 제본(A3 가로 양면)으로 그린다 */
  booklet?: boolean;
  /** 표지 (없으면 null) — 문제지와 같은 표지에 ' - 답지' 꼬리 */
  cover?: PaperCover | null;
  /** 표지 그림(앞·뒤)의 서명 URL 과 깨짐 — 깨졌으면 그 자리에 인쇄되는 안내를 그린다 */
  coverImages?: CoverSlotImages;
  /** 디자인 표지의 선생님 이름 */
  coverTeacher?: string;
  /** 표지를 읽지 못했을 때 표지 자리에 찍을 안내 (있으면 표지 대신 이것) */
  coverNotice?: string;
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
 *
 * 주관식·서술형은 격자에 **'해설 참조'** 라고만 적고 답 글자는 아래 해설 구역에 둔다
 * (2026-10-10, 사용자 결정 — "그래야 빠른 정답은 보기 편하지"). 선지 기호는 원문자라 숫자가
 * 작아 격자에서 크게 찍는다(`.pb-answer-value--choice`).
 */
export default function ProblemAnswerKeyView({
  paper, items, booklet = false, cover = null, coverImages, coverTeacher, coverNotice,
}: ProblemAnswerKeyViewProps) {
  const title = `${paper.title} - 답지`;
  const rows = useMemo(() => buildAnswerRows(items), [items]);
  const explanations = useMemo(() => explanationEntries(items), [items]);

  const blocks = useMemo(() => renderAnswerKeyBlocks(rows, explanations), [rows, explanations]);

  const coverSlots = renderCoverSlots({
    cover, paperTitle: paper.title, suffix: ' - 답지',
    images: coverImages, notice: coverNotice, year: coverYearOf(paper.created_at), teacher: coverTeacher,
  });

  return (
    <A4Document
      blocks={blocks}
      booklet={booklet}
      {...coverSlots}
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
