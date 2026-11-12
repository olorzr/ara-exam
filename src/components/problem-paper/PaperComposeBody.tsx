'use client';

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import ArchiveSidePanel from '@/components/problem-bank/ArchiveSidePanel';
import ProblemDetailDialog from '@/components/problem-bank/ProblemDetailDialog';
import PaperArchiveColumn from '@/components/problem-paper/PaperArchiveColumn';
import PaperCanvasColumn from '@/components/problem-paper/PaperCanvasColumn';
import type { PaperToolbarEditMode } from '@/components/problem-paper/PaperToolbar';
import TypeMixDialog from '@/components/problem-paper/TypeMixDialog';
import { useListDrag } from '@/hooks/useListDrag';
import { usePaperBulkAdd } from '@/hooks/usePaperBulkAdd';
import type { PaperComposer } from '@/hooks/usePaperComposer';
import { usePaperTypeMix } from '@/hooks/usePaperTypeMix';
import { useProblemArchive, type ArchiveRow } from '@/hooks/useProblemArchive';
import { useSignedImageUrls } from '@/hooks/useSignedImageUrls';
import { displayOfArchiveRow, displayOfSnapshot } from '@/lib/problem-paper/canvas-display';
import type { PaperItem } from '@/lib/problem-paper/compose';
import type { StoredPaperItem } from '@/lib/problem-paper/edit-items';
import { EMPTY_FILTERS, paperExclusionsOf, type ProblemFilters } from '@/lib/problem-bank/filters';

/** 첫 필터 — 정답 없는 문항은 처음부터 뺀다(2026-11-07 원장 결정, 체크를 풀면 돌아온다) */
const COMPOSE_FILTERS: ProblemFilters = { ...EMPTY_FILTERS, answered_only: true };

/** 평가문제집까지 보는 첫 필터 — 책 만들기의 문제지 만들기·고치기가 쓴다 */
const WITH_WORKBOOK_FILTERS: ProblemFilters = { ...COMPOSE_FILTERS, with_workbook: true };

interface PaperComposeBodyProps {
  /** 평가문제집을 보이는가 — 책 만들기 쪽 두 주소(`/books/papers/new`·`/books/papers/[id]/edit`)만 켠다 */
  withWorkbook: boolean;
  paper: PaperComposer;
  /** 화면 머리(제목·안내·고치기 띠) */
  header: ReactNode;
  saving: boolean;
  onSave: () => void;
  /** 고치기 화면이면 넘긴다 */
  edit?: PaperToolbarEditMode;
  /** 고치기 화면이면 그 문제지 id — 빼기 고르기에서 자신을 숨긴다 */
  hidePaperId?: string;
}

/**
 * 문제지 조합의 몸통 — 트리 · 아카이브 목록 · 캔버스 · 상세 창 · 비율 담기 창.
 *
 * 만들기(`PaperComposeScreen`)와 고치기(`PaperEditScreen`)가 **같은 몸통**을 쓴다. 다른 것은 머리와 저장뿐이다.
 * 왼쪽 아카이브에서 오른쪽 캔버스로 **끌어다 놓는다**. 마우스가 없거나 키보드만 쓰는 경우를 위해 담기(＋)·위·아래
 * 버튼도 항상 함께 둔다. 맨 왼쪽 트리는 아카이브와 **같은 패널**(`ArchiveSidePanel`)이다.
 * @param props - 조합 상태 · 머리 · 저장
 * @returns 조합 화면
 */
export default function PaperComposeBody({
  withWorkbook, paper, header, saving, onSave, edit, hidePaperId,
}: PaperComposeBodyProps) {
  const archive = useProblemArchive(withWorkbook ? WITH_WORKBOOK_FILTERS : COMPOSE_FILTERS);
  const bulk = usePaperBulkAdd(archive, paper);
  const mix = usePaperTypeMix(archive, paper, bulk);
  /**
   * 담기가 하나라도 도는 중인가 — 잠금이 하나라 단추를 **함께** 잠근다. 고치기의 '최신 지문으로' 가 지금 지문 id 를 읽는
   * 중이어도 같다 — 그사이 저장하면 바꾸기 전 상태가 나가고 화면을 떠나 그 바꾸기가 사라진다(코덱스 정지 게이트)
   */
  const addBusy = bulk.bulkBusy || mix.busy || Boolean(paper.refreshing);
  /** 상세 창의 형제 문항에도 같은 빼기 조건을 건다 */
  const exclusions = useMemo(() => paperExclusionsOf(archive.filters), [archive.filters]);
  const canvasRef = useRef<HTMLDivElement>(null);

  /** 지금 끌고 있는 것 — 아카이브에서 새로 담는 중이거나, 캔버스 안에서 옮기는 중 */
  const [source, setSource] = useState<{ kind: 'add'; row: ArchiveRow } | { kind: 'move'; from: number } | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  /** 상세 창에 띄운 문항 — 담기 전에 지문과 함께 확인한다 */
  const [openId, setOpenId] = useState<string | null>(null);

  /** 저장 항목을 문항 id 로 — '최신 지문으로' 바꿔 항목 id 를 뗀 자리를 그릴 때 */
  const storedByProblem = useMemo(() => {
    const map = new Map<string, StoredPaperItem>();
    for (const s of paper.stored.values()) if (s.problemId) map.set(s.problemId, s);
    return map;
  }, [paper.stored]);

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

  /**
   * 저장 — 담기가 도는 중이면 막는다(단추도 잠근다). 끝나기 전에 저장하면 그 담기가 저장 뒤에 들어와 화면을 떠날 때 사라진다
   * (코덱스 P2). 저장하는 동안은 화면 전체를 `inert` 로 잠근다 — 보낸 뒤에 고친 것은 저장되지 않는데 저장이 끝나면 화면을 떠난다.
   */
  const handleSave = () => {
    if (addBusy || saving) return;
    onSave();
  };

  /**
   * 카드에 그릴 것 — 고치기의 기존 항목은 **저장된 스냅샷**(인쇄와 같은 모습), 새로 담은 문항은 원본.
   * 새 문항의 원본은 필터를 바꿔도 보여야 해서 담을 때 들어 둔 행(`paper.rows`)을 먼저 본다.
   */
  const displayFor = (item: PaperItem) => {
    const stored = item.itemId ? paper.stored.get(item.itemId) : undefined;
    if (stored) return displayOfSnapshot(stored.snapshot, stored.problemId === null);
    const row = paper.rows.get(item.problemId) ?? archive.rows.find((r) => r.id === item.problemId);
    if (row) return displayOfArchiveRow(row, edit ? 'new' : undefined);
    // '최신 지문으로' 바꾼 저장 항목 — 원본 행을 안 받아 왔으니 저장된 모습으로 그리고 표시만 단다
    const refreshed = storedByProblem.get(item.problemId);
    return refreshed ? displayOfSnapshot(refreshed.snapshot, false, 'refresh') : undefined;
  };

  return (
    <div className="space-y-4" inert={saving} aria-busy={saving}>
      {header}

      {/* 세 칸은 xl(1280px)부터 — 앱 사이드바(w-60, 240px)와 트리 칸(260px)을 뺀 자리에
          아카이브처럼 lg 에서 가르면 목록·캔버스가 각 220px 안팎이 되어 카드(썸네일·손잡이·담기)가 접힌다.
          그 아래 폭에서는 트리가 위로 쌓인다(아카이브가 lg 미만에서 하는 것과 같다) */}
      <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
        <div className="xl:sticky xl:top-4 xl:self-start">
          {/* ⚠️ 조건을 바꾸는 길은 전부 `bulk.patch` 를 지난다 — 선택을 비우지 않으면
              다른 폴더의 문항이 선택된 채로 남아 '3개 선택됨' 이 거짓이 된다 */}
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
          <PaperArchiveColumn
            archive={archive}
            bulk={bulk}
            addBusy={addBusy}
            added={paper.added}
            thumbnailUrls={thumbnails.urls}
            hidePaperId={hidePaperId}
            onAdd={(row) => paper.add(row)}
            onOpen={setOpenId}
            onOpenMix={mix.openDialog}
            dragHandlersFor={(row) => ({
              ...drag.handlers,
              onPointerDown: (e) => {
                setSource({ kind: 'add', row });
                drag.handlers.onPointerDown(e);
              },
            })}
          />

          <PaperCanvasColumn
            paper={paper}
            drag={drag}
            canvasRef={canvasRef}
            preview={preview}
            displayFor={displayFor}
            saving={saving}
            saveBlocked={addBusy}
            edit={edit}
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
        exclusions={exclusions}
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
