'use client';

import { useMemo, type RefObject } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import CanvasItem from '@/components/problem-paper/CanvasItem';
import PaperToolbar, { type PaperToolbarEditMode } from '@/components/problem-paper/PaperToolbar';
import type { useListDrag } from '@/hooks/useListDrag';
import type { PaperComposer } from '@/hooks/usePaperComposer';
import type { CanvasItemDisplay } from '@/lib/problem-paper/canvas-display';
import { groupsOf, type PaperItem } from '@/lib/problem-paper/compose';
import { describeOmrPlan } from '@/lib/problem-paper/omr-payload';

interface PaperCanvasColumnProps {
  paper: PaperComposer;
  drag: ReturnType<typeof useListDrag>;
  canvasRef: RefObject<HTMLDivElement | null>;
  /** 끌어다 놓을 자리 표시 */
  preview: number | null;
  /** 카드에 그릴 것 — 새로 담은 문항은 원본, 고치기의 기존 항목은 저장된 스냅샷 */
  displayFor: (item: PaperItem) => CanvasItemDisplay | undefined;
  /** 저장 중 */
  saving: boolean;
  /** 문항을 담는 중 — 저장 단추를 잠근다 */
  saveBlocked?: boolean;
  /** 고치기 화면이면 넘긴다 */
  edit?: PaperToolbarEditMode;
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
  paper, drag, canvasRef, preview, displayFor, saving, saveBlocked, edit, onStartMove, onSave,
}: PaperCanvasColumnProps) {
  const groups = useMemo(() => groupsOf(paper.items), [paper.items]);
  const groupStarts = useMemo(() => new Set(groups.map((g) => g.start)), [groups]);
  /**
   * 고치기 — '최신 지문으로' 를 낼 묶음의 시작 자리 → 끝 자리. 지문 묶음이고 전부 원본이 살아 있는 **저장 항목**일 때만
   * (원본이 지워진 항목이 섞이면 서버가 그 항목의 옛 지문을 물려줘 반만 바뀐다).
   */
  const refreshable = useMemo(() => {
    const map = new Map<number, number>();
    if (!edit) return map;
    for (const g of groups) {
      const slice = paper.items.slice(g.start, g.end + 1);
      const ok = g.passageId !== null
        && slice.every((i) => i.itemId !== undefined && Boolean(paper.stored.get(i.itemId)?.problemId));
      if (ok) map.set(g.start, g.end);
    }
    return map;
  }, [edit, groups, paper.items, paper.stored]);
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
        saving={saving}
        longestPassageChars={LONGEST_PASSAGE_CHARS}
        omrNotice={paper.omrPlan ? describeOmrPlan(paper.omrPlan) : null}
        edit={edit}
        saveBlocked={saveBlocked}
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
                display={displayFor(item)}
                number={index + 1}
                groupStart={groupStarts.has(index)}
                inPassage={item.passageId !== null}
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
                onRefreshGroup={refreshable.has(index) ? () => {
                  void paper.refreshGroup(index, refreshable.get(index) ?? index);
                } : undefined}
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
