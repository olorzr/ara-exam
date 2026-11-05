'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import ArchiveList from '@/components/problem-bank/ArchiveList';
import ArchiveLoadError from '@/components/problem-bank/ArchiveLoadError';
import ArchivePager from '@/components/problem-bank/ArchivePager';
import ArchiveSidePanel from '@/components/problem-bank/ArchiveSidePanel';
import ProblemCard from '@/components/problem-bank/ProblemCard';
import ProblemDetailDialog from '@/components/problem-bank/ProblemDetailDialog';
import ProblemFilterBar from '@/components/problem-bank/ProblemFilterBar';
import PaperCanvasColumn from '@/components/problem-paper/PaperCanvasColumn';
import PaperPickBar from '@/components/problem-paper/PaperPickBar';
import PassageAddButton from '@/components/problem-paper/PassageAddButton';
import TypeMixDialog from '@/components/problem-paper/TypeMixDialog';
import { useListDrag } from '@/hooks/useListDrag';
import { usePaperBulkAdd } from '@/hooks/usePaperBulkAdd';
import { usePaperComposer } from '@/hooks/usePaperComposer';
import { usePaperTypeMix } from '@/hooks/usePaperTypeMix';
import { useProblemArchive, type ArchiveRow } from '@/hooks/useProblemArchive';
import { useSignedImageUrls } from '@/hooks/useSignedImageUrls';
import { EMPTY_FILTERS, type ProblemFilters } from '@/lib/problem-bank/filters';
import { fireGradeSync } from '@/lib/grade-sync-client';

/** 평가문제집까지 보는 첫 필터 — 책 만들기의 문제지 만들기가 쓴다 */
const WITH_WORKBOOK_FILTERS: ProblemFilters = { ...EMPTY_FILTERS, with_workbook: true };

interface PaperComposeScreenProps {
  /**
   * 평가문제집을 보이는가 — 책 만들기의 문제지 만들기(`/books/papers/new`)만 켠다.
   * 문제 은행의 문제지 조합은 다른 유형만 본다(2026-11-05 "책 만들 때 빼고는 안 쓸 거라서").
   */
  withWorkbook?: boolean;
}

/**
 * 문제지 조합 화면 — 문제 은행(`/problems/papers/new`)과 책 만들기(`/books/papers/new`)가 **같은 화면**을 쓴다.
 *
 * 왼쪽 아카이브에서 오른쪽 캔버스로 **끌어다 놓는다**. 순서도 끌어서 바꾼다.
 * 마우스가 없거나 키보드만 쓰는 경우를 위해 담기(＋)·위·아래 버튼도 항상 함께 둔다.
 *
 * 맨 왼쪽 트리는 아카이브(`/problems/archive`)와 **같은 패널**(`ArchiveSidePanel`)이다 —
 * 단원·학교·작품·문법 폴더를 눌러 목록을 좁힌 뒤 그 자리에서 바로 담는다.
 * @param props - 평가문제집을 보이는지
 * @returns 조합 화면
 */
export default function PaperComposeScreen({ withWorkbook = false }: PaperComposeScreenProps) {
  const router = useRouter();
  const archive = useProblemArchive(withWorkbook ? WITH_WORKBOOK_FILTERS : EMPTY_FILTERS);
  const paper = usePaperComposer();
  const bulk = usePaperBulkAdd(archive, paper);
  const mix = usePaperTypeMix(archive, paper, bulk);
  /** 담기가 하나라도 도는 중인가 — 잠금이 하나라 단추를 **함께** 잠근다 */
  const addBusy = bulk.bulkBusy || mix.busy;
  const canvasRef = useRef<HTMLDivElement>(null);

  /** 지금 끌고 있는 것 — 아카이브에서 새로 담는 중이거나, 캔버스 안에서 옮기는 중 */
  const [source, setSource] = useState<{ kind: 'add'; row: ArchiveRow } | { kind: 'move'; from: number } | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  /** 상세 창에 띄운 문항 — 담기 전에 지문과 함께 확인한다 */
  const [openId, setOpenId] = useState<string | null>(null);

  const thumbnails = useSignedImageUrls(archive.rows.map((r) => r.image_path).filter(Boolean));

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
    if (!id) return;
    // OMR 문제지는 학원 성적에 시험으로 등록한다(실패하면 경고 토스트 — 상세 화면에서 다시 보낼 수 있다)
    if (paper.settings.omr) fireGradeSync('/api/sync-paper-to-grades', { paperId: id });
    // ⚠️ 등록은 기다리지 않으므로 '등록했어요' 라고 말하지 않는다 — 실패하면 경고 토스트가 따로 뜬다
    toast.success(paper.settings.omr ? '문제지를 만들었어요. 학원 성적에도 등록하는 중이에요.' : '문제지를 만들었어요.');
    router.push(`/problems/papers/${id}`);
  };

  /** 담은 문항의 원본 — 필터를 바꿔도 이미 담은 것은 계속 보여야 한다 */
  const rowFor = (problemId: string): ArchiveRow | undefined =>
    paper.rows.get(problemId) ?? archive.rows.find((r) => r.id === problemId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">🧩 {withWorkbook ? '문제지 만들기' : '문제지 조합'}</h1>
        <p className="mt-1 text-sm text-gray-500">
          왼쪽 트리에서 단원·학교·작품·문법을 고르고, 문항을 끌어다 오른쪽에 놓으세요.
          고른 폴더를 <strong>통째로 담거나</strong>, 체크해서 여럿을, 또는
          <strong> 유형 비율</strong>(객관식 8 : 주관식 2 같은)로 무작위로 담을 수도 있어요.
          같은 지문의 문항은 자동으로 붙습니다.
        </p>
        {withWorkbook && (
          <p className="mt-1 text-sm text-gray-500">
            평가문제집 문항은 여기서만 보여요. 만든 문제지는 내지 만들기의 장 담기에서 고르세요.
          </p>
        )}
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
            workbooks={archive.facets.workbooks}
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
              bulkBusy={addBusy}
              onEnter={bulk.selection.enter}
              onExit={bulk.selection.exit}
              onToggleAll={bulk.selection.toggleAll}
              onAddSelected={bulk.addSelected}
              onAddFolder={bulk.addFolder}
              onOpenMix={mix.openDialog}
            />

            <div className="max-h-[70vh] overflow-y-auto pr-1">
              {/* 아카이브와 **같은 목록 부품**이다 — 지문별로 묶어 그리는 규약을
                  사본으로 두면 언젠가 한쪽만 고쳐진다.
                  ⚠️ 지금 조건을 못 읽었으면 목록 대신 안내다 — 옛 조건의 행이 담기 대상이 되면 안 된다 */}
              {archive.failed ? (
                <ArchiveLoadError failure={archive.failed} onRetry={archive.retry} />
              ) : (
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
                    disabled={addBusy}
                    onAdd={bulk.addPassage}
                  />
                )}
              />
              )}
            </div>

            {/* 목록은 60개씩 끊어 온다 — 넘기는 버튼이 없으면 그 뒤 문항은 담을 수가 없다 */}
            <ArchivePager
              page={archive.filters.page}
              pageCount={archive.pageCount}
              onPage={(page) => bulk.patch({ page })}
            />
          </div>

          <PaperCanvasColumn
            paper={paper}
            drag={drag}
            canvasRef={canvasRef}
            preview={preview}
            rowFor={rowFor}
            onStartMove={(from) => setSource({ kind: 'move', from })}
            onSave={handleSave}
          />
        </div>
      </div>

      <ProblemDetailDialog
        problemId={openId}
        onClose={() => setOpenId(null)}
        onAdd={bulk.addRows}
        addedIds={paper.added}
      />

      <TypeMixDialog
        open={mix.open}
        session={mix.session}
        pool={mix.pool}
        poolError={mix.poolError}
        busy={mix.busy}
        added={paper.added}
        onConfirm={mix.confirm}
        onClose={mix.close}
      />
    </div>
  );
}
