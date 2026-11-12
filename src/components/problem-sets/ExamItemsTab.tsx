'use client';

import { useMemo } from 'react';
import PassageBodyView from '@/components/problem-bank/PassageBodyView';
import PassageWorksLine from '@/components/problem-bank/PassageWorksLine';
import ProblemBodyView from '@/components/problem-bank/ProblemBodyView';
import { useSignedImageUrls } from '@/hooks/useSignedImageUrls';
import { examImagePaths } from '@/lib/problem-bank/exam-view-files';
import { groupExamItems } from '@/lib/problem-bank/exam-view-order';
import type { Passage, Problem } from '@/types/problem-bank';

interface ExamItemsTabProps {
  passages: Passage[];
  problems: Problem[];
}

/** 문항 머리의 작은 꼬리 — 번호는 본문(ProblemBodyView)이 찍는다 */
function problemMeta(problem: Problem): string {
  return problem.score !== null ? `${problem.question_type} · ${problem.score}점` : problem.question_type;
}

/** 지문 이름 — 작품이 있으면 작품, 없으면 머리(`[1~3]`) */
function passageName(passage: Passage): string {
  const works = (passage.works ?? []).map((w) => w.title).filter(Boolean);
  return works.length > 0 ? works.join(' · ') : passage.label || '지문';
}

/**
 * 읽기 전용 시험 보기의 '문항·지문' 탭 — 시험지를 처음부터 끝까지 읽는다.
 *
 * 차례·묶기는 `groupExamItems`(객관식·주관식 → 서술형, 같은 지문이 이어지면 한 덩어리)가 정한다.
 * 그리기는 문제 은행의 상세 창과 같은 부품(ProblemBodyView — 정답 강조 · 해설 접기)을 쓴다.
 * ⚠️ 본문은 흰 종이(`bg-card`) 위에 둔다 — 〈보기〉 말머리가 흰 바탕으로 테두리를 가려서, 민트 책상 위에 바로 놓으면
 *    말머리 뒤에 흰 조각이 보인다(CLAUDE.md 0.9.82).
 */
export default function ExamItemsTab({ passages, problems }: ExamItemsTabProps) {
  const blocks = useMemo(() => groupExamItems(passages, problems), [passages, problems]);
  const paths = useMemo(() => examImagePaths([...passages, ...problems]), [passages, problems]);
  const images = useSignedImageUrls(paths);

  if (blocks.length === 0) {
    return <p className="py-12 text-center text-sm text-gray-500">이 시험지에는 아직 읽어 낸 문항이 없어요.</p>;
  }

  return (
    <div className="space-y-3">
      {!images.loading && images.missing.length > 0 && (
        <p className="text-xs text-amber-700">
          그림 {images.missing.length}개를 불러오지 못했어요.{' '}
          <button type="button" onClick={images.reload} className="underline underline-offset-2">다시 불러오기</button>
        </p>
      )}
      {blocks.map((block, index) => {
        const head = block.passage ?? block.repeatOf;
        return (
          <section
            key={`${head?.id ?? 'none'}-${block.problems[0]?.id ?? index}`}
            className="space-y-3 rounded-lg border border-gray-200 bg-card p-4"
          >
            {block.passage && (
              <div className="space-y-1.5">
                <p className="flex flex-wrap items-baseline gap-2 text-sm">
                  <PassageWorksLine works={block.passage.works} fallback={block.passage.label || '지문'} />
                  {block.passage.label && block.passage.works?.length > 0 && (
                    <span className="text-xs text-gray-400">{block.passage.label}</span>
                  )}
                </p>
                <PassageBodyView
                  passage={block.passage}
                  imageUrl={block.passage.image_path ? images.urls.get(block.passage.image_path) : null}
                  figureUrls={images.urls}
                />
              </div>
            )}
            {block.repeatOf && (
              <p className="text-xs text-gray-500">앞에 나온 지문 「{passageName(block.repeatOf)}」에 딸린 문항이에요.</p>
            )}
            {block.problems.map((problem, i) => (
              <article
                key={problem.id}
                className={i > 0 || block.passage ? 'space-y-1 border-t border-dashed border-gray-200 pt-3' : 'space-y-1'}
              >
                <p className="text-right text-xs text-gray-400">{problemMeta(problem)}</p>
                <ProblemBodyView problem={problem} imageUrls={images.urls} />
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}
