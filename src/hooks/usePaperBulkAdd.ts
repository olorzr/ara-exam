'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { hasActiveFilters, toProblemQuery, type ProblemFilters } from '@/lib/problem-bank/filters';
import { fetchProblemsForBulkAdd } from '@/lib/problem-bank/queries';
import { bulkAddToast, folderTooBigMessage, PAPER_MAX_ITEMS } from '@/lib/problem-paper/bulk-add';
import { useArchiveSelection } from './useArchiveSelection';
import type { ArchiveRow } from './useProblemArchive';

/**
 * 불러오는 중일 때 선택에 넘길 목록.
 *
 * ⚠️ 렌더마다 `[]` 를 새로 만들면 훅의 메모가 매번 깨진다 — 상수 하나를 재사용한다
 *    (아카이브 화면과 같은 규약).
 */
const NO_ROWS: ArchiveRow[] = [];

/** 이 훅이 쓰는 목록 화면의 상태 — `useProblemArchive` 의 일부 */
interface ArchiveLike {
  filters: ProblemFilters;
  rows: ArchiveRow[];
  total: number;
  loading: boolean;
  patch: (next: Partial<ProblemFilters>) => void;
  reset: () => void;
}

/** 이 훅이 쓰는 캔버스의 상태 — `usePaperComposer` 의 일부 */
interface ComposerLike {
  /**
   * 담는다. **상한 검사는 캔버스가 한다** — 여기서 미리 재면 비동기 사이에 늘어난 것을
   * 놓친다(코덱스 리뷰 2R). 막히면 캔버스가 알리고 null 을 돌려준다.
   */
  addMany: (
    incoming: readonly ArchiveRow[], at?: number,
  ) => { added: number; skipped: number } | null;
  /** '비우기' 세대 — 오래 걸리는 담기가 돌아와서 견준다 */
  clearSeq: () => number;
}

/**
 * 문제지 조합 화면의 **골라 담기**.
 *
 * 길이 둘이다:
 *  - **선택 담기** — 체크박스로 고른 것만. 지금 쪽에 보이는 행이 대상이다.
 *  - **폴더 담기** — 지금 조건에 걸린 **전부**. 화면에 60개만 보여도 조건에 걸린 것을
 *    다시 조회해 담는다(쪽을 넘겨 가며 ＋ 를 누르게 하지 않으려고 만든 길이다).
 *
 * @param archive - 목록 상태 (`useProblemArchive`)
 * @param paper - 캔버스 상태 (`usePaperComposer`)
 * @returns 선택 상태와 담기 동작, 그리고 **선택을 비우는 `patch`/`reset` 래퍼**
 */
export function usePaperBulkAdd(archive: ArchiveLike, paper: ComposerLike) {
  /**
   * ⚠️ 불러오는 중에는 **보이는 행이 없다**(화면은 스피너다). 옛 쪽의 행을 그대로 넘기면
   *    '전체 선택 → 담기' 가 화면에 없는 이전 쪽 문항을 담는다(아카이브와 같은 규약).
   */
  const selection = useArchiveSelection(archive.loading ? NO_ROWS : archive.rows);
  const [folderBusy, setFolderBusy] = useState(false);

  /** 조회가 도는 동안 두 번째 누름을 막는다 — state 는 이 실행 흐름에서 아직 안 바뀐다 */
  const busyRef = useRef(false);
  /**
   * 조건이 바뀐 세대 번호.
   *
   * ⚠️ **동기로** 올린다(`patch`/`reset` 안에서). 효과로 맞추면 조건을 바꾼 직후에
   *    돌아온 옛 조회가 "아직 같은 조건" 으로 보여 **보이는 것과 다른 폴더**가 담긴다
   *    (코덱스 리뷰 2R). 아카이브 화면의 `viewSeq` 와 같은 규약.
   */
  const filterSeq = useRef(0);
  /** 화면이 아직 붙어 있는가 (StrictMode 는 마운트를 두 번 한다 — 반드시 true 로 되돌린다) */
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  /**
   * 조건이 바뀌면 선택을 비운다.
   *
   * ⚠️ 이 화면에서 조건을 바꾸는 길은 **전부 이 함수**를 지나야 한다(트리·필터 줄·쪽 넘김).
   *    선택을 남기면 다른 쪽 문항이 선택된 채로 남아 '3개 선택됨' 이 거짓이 된다.
   */
  const patch = useCallback((next: Partial<ProblemFilters>) => {
    filterSeq.current += 1;
    selection.clear();
    archive.patch(next);
  }, [selection, archive]);

  const reset = useCallback(() => {
    filterSeq.current += 1;
    selection.clear();
    archive.reset();
  }, [selection, archive]);

  /** 체크한 문항을 담는다 */
  const addSelected = useCallback(() => {
    const picked = new Set(selection.selectedVisible);
    const rows = archive.rows.filter((row) => picked.has(row.id));
    if (rows.length === 0) return;

    // 상한 검사와 알림은 캔버스가 한다 — 막히면 null
    const result = paper.addMany(rows);
    if (!result) return;
    toast.success(bulkAddToast(result.added, result.skipped));
    selection.exit();
  }, [archive.rows, paper, selection]);

  /** 지금 조건에 걸린 문항을 통째로 담는다 */
  const addFolder = useCallback(async () => {
    // ⚠️ 잠금은 첫 await 앞에서 건다 — 뒤에 걸면 두 번 누른 사이에 조회가 둘 돈다
    if (busyRef.current) return;

    // 폴더 자체가 상한을 넘으면 조회도 하지 않는다 — 어차피 잘라 담을 수 없다
    const tooBig = folderTooBigMessage(archive.total);
    if (tooBig) { toast.error(tooBig); return; }

    busyRef.current = true;
    setFolderBusy(true);
    // 누른 그 순간의 조건과 세대 — 둘 다 이 자리에서 잡는다(닫아 두는 값이 아니다)
    const asked = toProblemQuery(archive.filters);
    const askedSeq = filterSeq.current;
    const askedClear = paper.clearSeq();
    try {
      // ⚠️ 남은 자리가 아니라 **폴더 전체**(상한까지)를 받아 온다. 남은 자리만큼만 받으면
      //    앞쪽이 이미 담긴 문항으로 채워졌을 때 **새 문항이 한 건도 안 든 목록**을 받고도
      //    그 사실을 알 수 없다 — 몇 개가 새것인지는 받아 봐야 안다
      const page = await fetchProblemsForBulkAdd(asked, PAPER_MAX_ITEMS);
      if (!aliveRef.current) return;

      // 조회하는 사이 다른 폴더를 눌렀다 — 보이는 것과 다른 것을 담으면 안 된다
      if (filterSeq.current !== askedSeq) {
        toast.error('고른 폴더가 바뀌어 담지 않았어요. 다시 눌러 주세요.');
        return;
      }
      // 조회하는 사이 '비우기' 를 눌렀다 — 방금 비운 캔버스를 도로 채우면 안 된다
      if (paper.clearSeq() !== askedClear) {
        toast.error('담는 사이에 캔버스를 비워서 담지 않았어요.');
        return;
      }
      // 조회하는 사이 문항이 늘었을 수 있다(다른 선생님의 업로드).
      // `total` 은 조건에 걸린 전체 개수라, 상한을 넘으면 받아 온 목록이 **앞에서 잘린 것**이다
      const grew = folderTooBigMessage(page.total);
      if (grew) { toast.error(grew); return; }

      // 상한 검사는 캔버스가 **담는 그 자리에서** 한다 — 여기서 미리 재면 조회를 기다리는
      // 사이 ＋·끌기로 늘어난 것을 놓친다(코덱스 리뷰 2R)
      const result = paper.addMany(page.rows);
      if (!result) return;
      toast.success(bulkAddToast(result.added, result.skipped));
      selection.exit();
    } catch (e) {
      if (aliveRef.current) toast.error(e instanceof Error ? e.message : '담지 못했어요.');
    } finally {
      busyRef.current = false;
      if (aliveRef.current) setFolderBusy(false);
    }
  }, [archive.filters, archive.total, paper, selection]);

  return {
    selection,
    patch,
    reset,
    folderBusy,
    /** 담을 폴더가 정해져 있는가 — 조건이 하나도 없으면 '전체' 라 담을 폴더가 아니다 */
    folderEnabled: hasActiveFilters(archive.filters) && archive.total > 0 && !archive.loading,
    addSelected,
    addFolder,
  };
}
