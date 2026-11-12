'use client';

import type { HTMLAttributes } from 'react';
import ArchiveList from '@/components/problem-bank/ArchiveList';
import ArchiveLoadError from '@/components/problem-bank/ArchiveLoadError';
import ArchivePager from '@/components/problem-bank/ArchivePager';
import ProblemCard from '@/components/problem-bank/ProblemCard';
import ProblemFilterBar from '@/components/problem-bank/ProblemFilterBar';
import PaperExcludeBar from '@/components/problem-paper/PaperExcludeBar';
import PaperPickBar from '@/components/problem-paper/PaperPickBar';
import PassageAddButton from '@/components/problem-paper/PassageAddButton';
import type { usePaperBulkAdd } from '@/hooks/usePaperBulkAdd';
import type { ArchiveRow, useProblemArchive } from '@/hooks/useProblemArchive';

interface PaperArchiveColumnProps {
  archive: ReturnType<typeof useProblemArchive>;
  bulk: ReturnType<typeof usePaperBulkAdd>;
  /** 담기가 하나라도 도는 중 — 묶음 담기 단추를 잠근다 */
  addBusy: boolean;
  /** 캔버스에 이미 담긴 문항 id */
  added: ReadonlySet<string>;
  /** 썸네일 서명 주소 */
  thumbnailUrls: ReadonlyMap<string, string>;
  /** 고치기 화면이면 그 문제지 id — '다른 문제지에 담긴 문항 빼기' 고르기에서 자신을 숨긴다 */
  hidePaperId?: string;
  onAdd: (row: ArchiveRow) => void;
  onOpen: (problemId: string) => void;
  onOpenMix: () => void;
  /** 이 행을 캔버스로 끌어 담는 손잡이 */
  dragHandlersFor: (row: ArchiveRow) => HTMLAttributes<HTMLElement>;
}

/**
 * 문제지 조합의 가운데 칸 — 필터 줄 · 빼기 줄 · 골라 담기 줄 · 아카이브 목록 · 쪽 넘기기.
 * 만들기와 고치기가 같이 쓴다.
 * @param props - 목록 상태와 담기 동작
 * @returns 가운데 칸
 */
export default function PaperArchiveColumn({
  archive, bulk, addBusy, added, thumbnailUrls, hidePaperId, onAdd, onOpen, onOpenMix, dragHandlersFor,
}: PaperArchiveColumnProps) {
  return (
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

      <PaperExcludeBar
        papers={archive.filters.exclude_papers}
        answeredOnly={archive.filters.answered_only}
        hidePaperId={hidePaperId}
        onChange={bulk.patch}
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
        onOpenMix={onOpenMix}
      />

      <div className="max-h-[70vh] overflow-y-auto pr-1">
        {/* 아카이브와 **같은 목록 부품**이다 — 지문별로 묶어 그리는 규약을 사본으로 두면 언젠가 한쪽만 고쳐진다.
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
                thumbnailUrl={thumbnailUrls.get(row.image_path) ?? null}
                added={added.has(row.id)}
                showEditLink={false}
                selectMode={bulk.selection.selectMode}
                selected={bulk.selection.isSelected(row.id)}
                onToggleSelect={() => bulk.selection.toggle(row.id)}
                onOpen={() => onOpen(row.id)}
                // ⚠️ 선택 모드에서는 ＋ 와 끌기를 내주지 않는다. 카드 전체가 이미 선택
                //    토글이라, 손잡이를 잡으면 끌기와 선택이 같은 포인터를 두고 다툰다
                onAdd={bulk.selection.selectMode ? undefined : () => onAdd(row)}
                dragHandlers={bulk.selection.selectMode ? undefined : dragHandlersFor(row)}
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
  );
}
