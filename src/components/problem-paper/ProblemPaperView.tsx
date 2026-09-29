'use client';

import { useMemo } from 'react';
import { A4Document, CompactPageHeader } from '@/components/print';
import ExamPrintHeader from '@/components/exam/ExamPrintHeader';
import { buildPaperBlocks } from '@/lib/problem-paper/blocks';
import { buildOmrAnswerKey, omrSheetCountOf } from '@/lib/problem-paper/omr-payload';
import type { PaperItemSnapshot, ProblemPaper } from '@/types/problem-bank';
import { renderPaperBlocks } from './PaperPrintBlocks';

interface ProblemPaperViewProps {
  paper: ProblemPaper;
  items: PaperItemSnapshot[];
  /**
   * 경로 → 서명 URL.
   *
   * 훅을 여기서 부르지 않고 **페이지가 들고 내려 준다** — 이미지가 아직 안 왔거나
   * 실패했는지를 페이지가 알아야 인쇄를 막을 수 있기 때문이다(코덱스 리뷰 7R).
   */
  imageUrls: Map<string, string>;
  /**
   * 교사용인가 — 정답 선지에 표시가 붙고 문항 밑에 답·해설이 온다.
   *
   * 문제지와 **같은 컴포넌트**다. 두 벌로 두면 문항 모양이 언젠가 한쪽만 고쳐져
   * 선생님이 든 종이와 학생이 든 종이가 달라진다(학교 프린트 문답과 같은 규약).
   */
  showAnswers?: boolean;
}

/**
 * 기출 문제지 인쇄 뷰.
 *
 * 인쇄 엔진(`A4Document`)은 그대로 쓴다 — 블록 배열만 만들어 넘기면 된다.
 * 지문은 문단 단위 블록이라 단·쪽을 넘어 흘러가고, 문항은 하나가 한 블록이다.
 */
export default function ProblemPaperView({
  paper, items, imageUrls, showAnswers = false,
}: ProblemPaperViewProps) {
  // OMR 문제지만 90A 답안지 안내를 붙인다 — 학생 종이에만(교사용은 채점하는 종이라 칸 안내가 필요 없다).
  // 장 수는 성적 시스템과 같은 규칙(버블로 채점하는 마지막 번호)으로 잰다
  const omrSheets = useMemo(
    () => (paper.settings.omr && !showAnswers ? omrSheetCountOf(buildOmrAnswerKey(items)) : 0),
    [items, paper.settings.omr, showAnswers],
  );
  const blocks = useMemo(
    () => renderPaperBlocks({
      blocks: buildPaperBlocks(items, showAnswers),
      settings: paper.settings,
      imageUrls,
      showAnswers,
      omrSheetCount: omrSheets,
    }),
    [items, paper.settings, imageUrls, showAnswers, omrSheets],
  );

  // 제목으로 두 인쇄물을 가른다 — 같은 제목이면 책상에 나란히 놓였을 때 구분이 안 된다
  const title = showAnswers ? `${paper.title} - 교사용` : paper.title;

  return (
    <A4Document
      blocks={blocks}
      columns={paper.settings.columns}
      // `--paper` 가 문항 사이를 넓힌다(다른 `.pb-sheet` 문서는 그대로). A4Document 가 이 클래스를
      // 측정 컨테이너와 낱장 양쪽에 붙이므로 넓힌 만큼이 배정에도 들어간다
      className="pb-sheet pb-sheet--paper"
      firstPageHeader={
        // 머리글에 출처를 모아 찍지 않는다 — 출처는 문항마다 그 자리에 있다(`showSource`)
        // 이름·점수란은 학생 종이에만 — 교사용에 두면 채점표처럼 보인다
        <>
          <ExamPrintHeader
            title={title}
            showScoreRow={!showAnswers}
            totalCount={items.length}
            answerSheetCount={omrSheets}
          />
          {omrSheets > 0 && (
            <div className="section-bar section-bar--mint mb-2">
              <span>
                객관식은 OMR 답안지(90A)에 표시하세요. 답이 여러 개인 문항은 해당 번호를 모두 표시해요.
                {omrSheets > 1 && ' 문항 번호 옆의 작은 숫자는 (답안지 장 - 칸 번호) 입니다.'}
              </span>
            </div>
          )}
        </>
      }
      laterPageHeader={<CompactPageHeader title={title} />}
    />
  );
}
