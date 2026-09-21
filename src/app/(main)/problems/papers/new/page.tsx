'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import ArchiveList from '@/components/problem-bank/ArchiveList';
import ArchivePager from '@/components/problem-bank/ArchivePager';
import ArchiveSidePanel from '@/components/problem-bank/ArchiveSidePanel';
import ProblemCard from '@/components/problem-bank/ProblemCard';
import ProblemDetailDialog from '@/components/problem-bank/ProblemDetailDialog';
import ProblemFilterBar from '@/components/problem-bank/ProblemFilterBar';
import CanvasItem from '@/components/problem-paper/CanvasItem';
import PaperPickBar from '@/components/problem-paper/PaperPickBar';
import PaperToolbar from '@/components/problem-paper/PaperToolbar';
import { useListDrag } from '@/hooks/useListDrag';
import { usePaperBulkAdd } from '@/hooks/usePaperBulkAdd';
import { usePaperComposer } from '@/hooks/usePaperComposer';
import { useProblemArchive, type ArchiveRow } from '@/hooks/useProblemArchive';
import { useSignedImageUrls } from '@/hooks/useSignedImageUrls';
import { groupsOf } from '@/lib/problem-paper/compose';

/**
 * 문제지 조합 (`/problems/papers/new`).
 *
 * 왼쪽 아카이브에서 오른쪽 캔버스로 **끌어다 놓는다**. 순서도 끌어서 바꾼다.
 * 마우스가 없거나 키보드만 쓰는 경우를 위해 담기(＋)·위·아래 버튼도 항상 함께 둔다.
 *
 * 맨 왼쪽 트리는 아카이브(`/problems/archive`)와 **같은 패널**(`ArchiveSidePanel`)이다 —
 * 단원·학교·작품·문법 폴더를 눌러 목록을 좁힌 뒤 그 자리에서 바로 담는다.
 */
export default function PaperComposePage() {
  const router = useRouter();
  const archive = useProblemArchive();
  const paper = usePaperComposer();
  const bulk = usePaperBulkAdd(archive, paper);
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
          왼쪽 트리에서 단원·학교·작품·문법을 고르고, 문항을 끌어다 오른쪽에 놓으세요.
          고른 폴더를 <strong>통째로 담거나</strong> 체크해서 여럿을 한 번에 담을 수도 있어요.
          같은 지문의 문항은 자동으로 붙습니다.
        </p>
      </div>

      {/* 세 칸은 xl(1280px)부터 — 앱 사이드바(w-60, 240px)와 트리 칸(260px)을 뺀 자리에
          아카이브처럼 lg 에서 가르면 목록·캔버스가 각 220px 안팎이 되어
          카드(썸네일·손잡이·담기)가 접힌다.
          그 아래 폭에서는 트리가 위로 쌓인다(아카이브가 lg 미만에서 하는 것과 같다) */}
      <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
        <div className="xl:sticky xl:top-4 xl:self-start">
          {/* ⚠️ 조건을 바꾸는 길은 전부 `bulk.patch` 를 지난다 — 선택을 비우지 않으면
              다른 폴더의 문항이 선택된 채로 남아 '3개 선택됨' 이 거짓이 된다
              (아카이브 화면과 같은 규약. 선택 모드가 생기기 전에는 필요 없던 래퍼다) */}
          <ArchiveSidePanel
            filters={archive.filters}
            schoolExams={archive.facets.schoolExams}
            works={archive.workFacets}
            grammarCounts={archive.grammarCounts}
            onChange={bulk.patch}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <ProblemFilterBar
              filters={archive.filters}
              facets={archive.facets}
              areaFacets={archive.areaFacets}
              unitFacets={archive.unitFacets}
              workFacets={archive.workFacets}
              total={archive.total}
              onChange={bulk.patch}
              onReset={bulk.reset}
            />

            <PaperPickBar
              selectMode={bulk.selection.selectMode}
              count={bulk.selection.count}
              isAllSelected={bulk.selection.isAllSelected}
              disabled={archive.loading || archive.rows.length === 0}
              folderTotal={archive.total}
              folderEnabled={bulk.folderEnabled}
              folderBusy={bulk.folderBusy}
              bulkBusy={bulk.bulkBusy}
              onEnter={bulk.selection.enter}
              onExit={bulk.selection.exit}
              onToggleAll={bulk.selection.toggleAll}
              onAddSelected={bulk.addSelected}
              onAddFolder={bulk.addFolder}
            />

            <div className="max-h-[70vh] overflow-y-auto pr-1">
              {/* 아카이브와 **같은 목록 부품**이다 — 지문별로 묶어 그리는 규약을
                  사본으로 두면 언젠가 한쪽만 고쳐진다 */}
              <ArchiveList
                rows={archive.rows}
                loading={archive.loading}
                workTitle={archive.filters.work_title}
                renderCard={(row) => (
                  <ProblemCard
                    key={row.id}
                    problem={row}
                    thumbnailUrl={thumbnails.urls.get(row.image_path) ?? null}
                    added={paper.added.has(row.id)}
                    showEditLink={false}
                    selectMode={bulk.selection.selectMode}
                    selected={bulk.selection.isSelected(row.id)}
                    onToggleSelect={() => bulk.selection.toggle(row.id)}
                    onOpen={() => setOpenId(row.id)}
                    // ⚠️ 선택 모드에서는 ＋ 와 끌기를 내주지 않는다. 카드 전체가 이미 선택
                    //    토글이라, 손잡이를 잡으면 끌기와 선택이 같은 포인터를 두고 다툰다
                    onAdd={bulk.selection.selectMode ? undefined : () => paper.add(row)}
                    dragHandlers={bulk.selection.selectMode ? undefined : {
                      ...drag.handlers,
                      onPointerDown: (e) => {
                        setSource({ kind: 'add', row });
                        drag.handlers.onPointerDown(e);
                      },
                    }}
                  />
                )}
                // 선택 모드에서는 묶음 담기도 내주지 않는다 — ＋ 와 같은 규약이다
                renderGroupAction={bulk.selection.selectMode ? undefined : (group) => (
                  <PassageAddButton
                    passageId={group.passageId}
                    busy={bulk.passageBusy === group.passageId}
                    disabled={bulk.bulkBusy}
                    onAdd={bulk.addPassage}
                  />
                )}
              />
            </div>

            {/* 목록은 60개씩 끊어 온다 — 넘기는 버튼이 없으면 그 뒤 문항은 담을 수가 없다 */}
            <ArchivePager
              page={archive.filters.page}
              pageCount={archive.pageCount}
              onPage={(page) => bulk.patch({ page })}
            />
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
      </div>

      <ProblemDetailDialog
        problemId={openId}
        onClose={() => setOpenId(null)}
        onAdd={bulk.addRows}
        addedIds={paper.added}
      />
    </div>
  );
}

/**
 * 지문 묶음 머리의 '이 지문 담기'.
 *
 * 지문에 딸린 문항은 **함께 담아야** 쓸모가 있다 — 문제지는 같은 지문의 문항이 붙어 있어야
 * 저장되고(`isContiguous`), 하나만 담으면 나머지는 잊힌다.
 *
 * ⚠️ 개수를 적지 않는다. 담는 것은 **그 지문의 문항 전부**인데(보이는 행이 아니다) 그 수는
 *    조회해 봐야 알고, 보이는 수를 적으면 실제로 담기는 수와 어긋난다 — 몇 개가 들어갔는지는
 *    담은 뒤 토스트가 말해 준다.
 */
function PassageAddButton({ passageId, busy, disabled, onAdd }: {
  passageId: string;
  busy: boolean;
  disabled: boolean;
  onAdd: (passageId: string) => void;
}) {
  return (
    <Button
      type="button" variant="outline" size="sm" className="text-xs"
      disabled={disabled}
      // 목록에 안 보이는 문항까지 담는다는 것을 손끝에도 남긴다 — 머리의 '문항 N' 은
      // **이 목록에 보이는** 수라 둘이 다를 수 있다
      title="지금 조건에 안 걸렸거나 다음 쪽에 있는 문항까지, 이 지문의 문항을 모두 담아요."
      onClick={() => onAdd(passageId)}
    >
      {busy ? '담는 중…' : '이 지문 전체 담기'}
    </Button>
  );
}
