'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import ProblemCard from '@/components/problem-bank/ProblemCard';
import ProblemDetailDialog from '@/components/problem-bank/ProblemDetailDialog';
import ProblemFilterBar from '@/components/problem-bank/ProblemFilterBar';
import CanvasItem from '@/components/problem-paper/CanvasItem';
import PaperToolbar from '@/components/problem-paper/PaperToolbar';
import { useListDrag } from '@/hooks/useListDrag';
import { usePaperComposer } from '@/hooks/usePaperComposer';
import { useProblemArchive, type ArchiveRow } from '@/hooks/useProblemArchive';
import { useSignedImageUrls } from '@/hooks/useSignedImageUrls';
import { groupsOf } from '@/lib/problem-paper/compose';

/**
 * 문제지 조합 (`/problems/papers/new`).
 *
 * 왼쪽 아카이브에서 오른쪽 캔버스로 **끌어다 놓는다**. 순서도 끌어서 바꾼다.
 * 마우스가 없거나 키보드만 쓰는 경우를 위해 담기(＋)·위·아래 버튼도 항상 함께 둔다.
 */
export default function PaperComposePage() {
  const router = useRouter();
  const archive = useProblemArchive();
  const paper = usePaperComposer();
  const canvasRef = useRef<HTMLDivElement>(null);

  /** 지금 끌고 있는 것 — 아카이브에서 새로 담는 중이거나, 캔버스 안에서 옮기는 중 */
  const [source, setSource] = useState<{ kind: 'add'; row: ArchiveRow } | { kind: 'move'; from: number } | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  /** 상세 창에 띄운 문항 — 담기 전에 지문과 함께 확인한다 */
  const [openId, setOpenId] = useState<string | null>(null);

  const thumbnails = useSignedImageUrls(archive.rows.map((r) => r.image_path).filter(Boolean));

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

  const commit = useCallback((index: number | null) => {
    const dragged = source;
    setSource(null);
    setPreview(null);
    if (!dragged || index === null) return;

    if (dragged.kind === 'add') paper.add(dragged.row, index);
    else paper.move(dragged.from, index);
  }, [paper, source]);

  const drag = useListDrag({ containerRef: canvasRef, onPreview: setPreview, onCommit: commit });

  const handleSave = async () => {
    const id = await paper.save();
    if (id) {
      toast.success('문제지를 만들었어요.');
      router.push(`/problems/papers/${id}`);
    }
  };

  /** 담은 문항의 원본 — 필터를 바꿔도 이미 담은 것은 계속 보여야 한다 */
  const rowFor = (problemId: string): ArchiveRow | undefined =>
    paper.rows.get(problemId) ?? archive.rows.find((r) => r.id === problemId);

  const longestPassageChars = 0; // 조합 화면에서는 지문 본문을 읽지 않는다(목록 컬럼에 없다)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">🧩 문제지 조합</h1>
        <p className="mt-1 text-sm text-gray-500">
          왼쪽에서 문항을 끌어다 오른쪽에 놓으세요. 같은 지문의 문항은 자동으로 붙습니다.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <ProblemFilterBar
            filters={archive.filters}
            facets={archive.facets}
            areaFacets={archive.areaFacets}
            unitFacets={archive.unitFacets}
            grammarFacets={archive.grammarFacets}
            workFacets={archive.workFacets}
            total={archive.total}
            onChange={archive.patch}
            onReset={archive.reset}
          />

          <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
            {archive.loading ? (
              <div className="flex justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary" />
              </div>
            ) : archive.rows.length === 0 ? (
              <p className="py-12 text-center text-sm text-gray-500">조건에 맞는 문항이 없어요.</p>
            ) : (
              archive.rows.map((row) => (
                <ProblemCard
                  key={row.id}
                  problem={row}
                  thumbnailUrl={thumbnails.urls.get(row.image_path) ?? null}
                  added={paper.added.has(row.id)}
                  showEditLink={false}
                  onOpen={() => setOpenId(row.id)}
                  onAdd={() => paper.add(row)}
                  dragHandlers={{
                    ...drag.handlers,
                    onPointerDown: (e) => {
                      setSource({ kind: 'add', row });
                      drag.handlers.onPointerDown(e);
                    },
                  }}
                />
              ))
            )}
          </div>

          {/* 목록은 60개씩 끊어 온다 — 넘기는 버튼이 없으면 그 뒤 문항은 담을 수가 없다 */}
          {archive.pageCount > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                type="button" variant="outline" size="sm"
                onClick={() => archive.patch({ page: archive.filters.page - 1 })}
                disabled={archive.filters.page <= 0}
              >
                이전
              </Button>
              <span className="text-sm text-gray-500">
                {archive.filters.page + 1} / {archive.pageCount}
              </span>
              <Button
                type="button" variant="outline" size="sm"
                onClick={() => archive.patch({ page: archive.filters.page + 1 })}
                disabled={archive.filters.page >= archive.pageCount - 1}
              >
                다음
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <PaperToolbar
            title={paper.title}
            settings={paper.settings}
            count={paper.items.length}
            saving={paper.saving}
            longestPassageChars={longestPassageChars}
            onTitle={paper.setTitle}
            onSettings={(patch) => paper.setSettings({ ...paper.settings, ...patch })}
            onShuffle={paper.shuffle}
            onClear={paper.clear}
            onSave={handleSave}
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
                        setSource({ kind: 'move', from: index });
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
      </div>

      <ProblemDetailDialog problemId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
