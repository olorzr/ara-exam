'use client';

import { useMemo } from 'react';
import { A4Document, CompactPageHeader } from '@/components/print';
import ExamPrintHeader from '@/components/exam/ExamPrintHeader';
import { buildPaperBlocks, imagePathsOf } from '@/lib/problem-paper/blocks';
import { useSignedImageUrls } from '@/hooks/useSignedImageUrls';
import type { PaperItemSnapshot, ProblemPaper } from '@/types/problem-bank';
import { renderPaperBlocks } from './PaperPrintBlocks';

interface ProblemPaperViewProps {
  paper: ProblemPaper;
  items: PaperItemSnapshot[];
}

/**
 * 기출 문제지 인쇄 뷰.
 *
 * 인쇄 엔진(`A4Document`)은 그대로 쓴다 — 블록 배열만 만들어 넘기면 된다.
 * 지문은 문단 단위 블록이라 단·쪽을 넘어 흘러가고, 문항은 하나가 한 블록이다.
 */
export default function ProblemPaperView({ paper, items }: ProblemPaperViewProps) {
  const imageUrls = useSignedImageUrls(useMemo(() => imagePathsOf(items), [items]));

  const blocks = useMemo(
    () => renderPaperBlocks({
      blocks: buildPaperBlocks(items, paper.settings),
      settings: paper.settings,
      imageUrls,
    }),
    [items, paper.settings, imageUrls],
  );

  return (
    <A4Document
      blocks={blocks}
      columns={paper.settings.columns}
      className="pb-sheet"
      firstPageHeader={
        <ExamPrintHeader
          title={paper.title}
          sourceLabels={paper.source_labels}
          showScoreRow
          totalCount={items.length}
        />
      }
      laterPageHeader={<CompactPageHeader title={paper.title} />}
    />
  );
}
