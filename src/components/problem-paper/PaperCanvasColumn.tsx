'use client';

import { useMemo, type RefObject } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import CanvasItem from '@/components/problem-paper/CanvasItem';
import PaperToolbar from '@/components/problem-paper/PaperToolbar';
import type { useListDrag } from '@/hooks/useListDrag';
import type { usePaperComposer } from '@/hooks/usePaperComposer';
import type { ArchiveRow } from '@/hooks/useProblemArchive';
import { groupsOf } from '@/lib/problem-paper/compose';
import { describeOmrPlan } from '@/lib/problem-paper/omr-payload';

interface PaperCanvasColumnProps {
  paper: ReturnType<typeof usePaperComposer>;
  drag: ReturnType<typeof useListDrag>;
  canvasRef: RefObject<HTMLDivElement | null>;
  /** 끌어다 놓을 자리 표시 */
  preview: number | null;
  /** 담은 문항의 원본 — 필터를 바꿔도 이미 담은 것은 계속 보여야 한다 */
  rowFor: (problemId: string) => ArchiveRow | undefined;
  /** 캔버스 안에서 끌기를 시작했다 */
  onStartMove: (from: number) => void;
  onSave: () => void;
}

/** 조합 화면에서는 지문 본문을 읽지 않는다(목록 컬럼에 없다) */
const LONGEST_PASSAGE_CHARS = 0;

/**
 * 문제지 조합의 오른쪽 칸 — 제목·설정 툴바와 담은 문항 캔버스.
 * @param props - 조합 상태와 끌기 손잡이
 * @returns 오른쪽 칸
 */
export default function PaperCanvasColumn({
  paper, drag, canvasRef, preview, rowFor, onStartMove, onSave,
}: PaperCanvasColumnProps) {
  const groups = useMemo(() => groupsOf(paper.items), [paper.items]);
  const groupStarts = useMemo(() => new Set(groups.map((g) => g.start)), [groups]);
  /** 항목 index → 그 항목이 속한 묶음 번호 (묶음 통째 이동에 쓴다) */
  const groupIndexOf = useMemo(() => {
    const map = new Map<number, number>();
    groups.forEach((g, gi) => {
      for (let i = g.start; i <= g.end; i += 1) map.set(i, gi);
    });
    return map;
  }, [groups]);

  return (
    <div className="space-y-3">
      <PaperToolbar
        title={paper.title}
        settings={paper.settings}
        count={paper.items.length}
        saving={paper.saving}
        longestPassageChars={LONGEST_PASSAGE_CHARS}
        omrNotice={paper.omrPlan ? describeOmrPlan(paper.omrPlan) : null}
        onTitle={paper.setTitle}
        onSettings={(patch) => paper.setSettings({ ...paper.settings, ...patch })}
        onShuffle={paper.shuffle}
        onClear={paper.clear}
        onSave={onSave}
      />

      <div
        ref={canvasRef}
        className={`max-h-[70vh] space-y-2 overflow-y-auto rounded-lg border-2 border-dashed p-3 transition ${
          drag.dragging ? 'border-primary bg-primary/5' : 'border-gray-200'
        }`}
      >
        {paper.items.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-gray-500">
              왼쪽에서 문항을 끌어다 놓거나 ＋ 를 누르세요.
            </CardContent>
          </Card>
        ) : (
          paper.items.map((item, index) => (
            <div key={item.problemId}>
              {preview === index && <div className="h-1 rounded bg-primary" />}
              <CanvasItem
                row={rowFor(item.problemId)}
                number={index + 1}
                groupStart={groupStarts.has(index)}
                onRemove={() => paper.remove(item.problemId)}
                onMoveUp={() => paper.move(index, index - 1)}
                onMoveDown={() => paper.move(index, index + 2)}
                onMoveGroupUp={groupIndexOf.get(index) === 0 ? undefined : () => {
                  const gi = groupIndexOf.get(index);
                  if (gi !== undefined) paper.moveWholeGroup(gi, gi - 1);
                }}
                onMoveGroupDown={
                  groupIndexOf.get(index) === groups.length - 1 ? undefined : () => {
                    const gi = groupIndexOf.get(index);
                    if (gi !== undefined) paper.moveWholeGroup(gi, gi + 1);
                  }
                }
                dragHandlers={{
                  ...drag.handlers,
                  onPointerDown: (e) => {
                    onStartMove(index);
                    drag.handlers.onPointerDown(e);
                  },
                }}
              />
            </div>
          ))
        )}
        {preview === paper.items.length && paper.items.length > 0 && (
          <div className="h-1 rounded bg-primary" />
        )}
      </div>
    </div>
  );
}
