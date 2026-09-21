'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { type ProblemFilters } from '@/lib/problem-bank/filters';
import { formatGrammarPath } from '@/lib/problem-bank/grammar-tree';
import { countPapersUsing, deleteProblems } from '@/lib/problem-bank/mutations';
import { addGrammarPaths } from '@/lib/problem-bank/mutations-source';
import { PROBLEM_PAGE_SIZE } from '@/lib/problem-bank/queries';
import { bulkDeleteConfirmMessage, pageAfterDelete } from '@/lib/problem-bank/selection';
import { useArchiveSelection } from './useArchiveSelection';
import type { ArchiveRow } from './useProblemArchive';

/**
 * 불러오는 중일 때 선택에 넘길 목록.
 *
 * ⚠️ 렌더마다 `[]` 를 새로 만들면 훅의 메모가 매번 깨진다 — 상수 하나를 재사용한다.
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
  reload: () => void;
}

/**
 * 아카이브의 **선택 → 삭제·문법 태깅**.
 *
 * 화면에서 떼어 둔 까닭은 줄 수가 아니라 규약이다 — 세대 번호 둘과 생존 표시가 서로 맞물려
 * 있어(아래) 한 곳에 모여 있어야 한 쪽만 고쳐지지 않는다.
 * @param archive - 목록 상태 (`useProblemArchive`)
 * @returns 선택 상태, 선택을 비우는 `patch`/`reset` 래퍼, 삭제·태깅 동작
 */
export function useArchiveBulkActions(archive: ArchiveLike) {
  /**
   * ⚠️ 불러오는 중에는 **보이는 행이 없다**(화면은 스피너다). 옛 쪽의 행을 그대로 넘기면
   *    '전체 선택 → 삭제' 가 **화면에 없는 이전 쪽 문항을 지운다**(코덱스 리뷰 P1).
   */
  const selection = useArchiveSelection(archive.loading ? NO_ROWS : archive.rows);
  const [deleting, setDeleting] = useState(false);
  const [tagging, setTagging] = useState(false);

  /**
   * 세대 둘. 지우는 동안 무엇이 바뀌었는지에 따라 할 일이 다르기 때문이다
   * (usePdfPages 의 genRef 와 같은 규약).
   *
   * · `viewSeq` — **조건·쪽**이 바뀌면 올라간다. 삭제 뒤 쪽 보정은 지울 때의 쪽·전체 개수를
   *   쓰므로, 조건이 바뀌었으면 그 계산을 새 조건에 얹으면 안 된다.
   * · `targetSeq` — 거기에 **선택**까지 포함한다. 확인창 앞에 문제지 수를 묻는 왕복이 있어,
   *   그 틈에 체크를 바꾸면 확인창의 개수와 실제로 지울 문항이 어긋난다.
   */
  const viewSeq = useRef(0);
  const targetSeq = useRef(0);
  /**
   * 화면이 아직 붙어 있는가 — 물어보는 사이에 다른 메뉴로 떠나면 확인창을 띄우지 않는다.
   *
   * ⚠️ 마운트할 때 **반드시 다시 true 로 되돌린다.** 개발 모드(StrictMode)는 마운트 →
   *    언마운트 → 재마운트를 하는데, 정리에서 false 로만 두면 재마운트 뒤에도 false 로
   *    남아 **선택 삭제가 통째로 먹통이 된다**(usePdfPages 와 같은 규약).
   */
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  /**
   * 조건이 바뀌면 선택을 비운다.
   *
   * ⚠️ 화면에서 조건을 바꾸는 길은 **전부 이 함수**를 지나야 한다. 선택을 남기면
   *    다른 쪽·다른 조건의 문항이 선택된 채로 남아, 지울 때 화면에 보이지 않는 것이
   *    함께 사라질 수 있다(삭제 대상은 한 번 더 걸러내지만 개수 표시가 거짓이 된다).
   */
  const patch = useCallback((next: Partial<ProblemFilters>) => {
    viewSeq.current += 1;
    targetSeq.current += 1;
    selection.clear();
    archive.patch(next);
  }, [selection, archive]);

  const reset = useCallback(() => {
    viewSeq.current += 1;
    targetSeq.current += 1;
    selection.clear();
    archive.reset();
  }, [selection, archive]);

  const toggleOne = useCallback((id: string) => {
    targetSeq.current += 1;
    selection.toggle(id);
  }, [selection]);

  const toggleAll = useCallback(() => {
    targetSeq.current += 1;
    selection.toggleAll();
  }, [selection]);

  /** 고른 문항을 지운다 */
  const bulkDelete = useCallback(async () => {
    const ids = selection.selectedVisible;
    if (ids.length === 0) return;

    const view = viewSeq.current;
    const target = targetSeq.current;
    setDeleting(true);
    try {
      const papers = await countPapersUsing(ids);
      // 묻는 사이에 화면을 떠났으면 조용히 그만둔다
      if (!aliveRef.current) return;
      // 지울 대상이 바뀌었으면 지우지 않는다 — 확인창의 개수가 거짓이 된다.
      // 조용히 끝내면 "왜 안 지워지지" 가 되므로 다시 누르라고 알린다
      if (target !== targetSeq.current) {
        toast.info('선택이 바뀌어 삭제를 멈췄어요. 다시 눌러 주세요.');
        return;
      }
      if (!window.confirm(bulkDeleteConfirmMessage(ids.length, papers))) return;

      await deleteProblems(ids);
      toast.success(`${ids.length}개 문항을 지웠어요.`);
      selection.exit();

      if (!aliveRef.current) return;

      // ⚠️ 여기서 보는 것은 **조건**의 세대다(선택이 아니다). 지우는 사이 체크를 바꿨을 뿐이면
      //    쪽·전체 개수는 그대로라 보정이 여전히 옳다 — 선택으로 막으면 마지막 쪽을 비우고도
      //    빈 쪽에 남는다(코덱스 리뷰 4R). 조건이 바뀌었을 때만 보정을 접고,
      //    그 경우에도 **목록은 반드시 다시 읽는다**(안 그러면 지운 문항이 남아 보인다).
      if (view !== viewSeq.current) {
        archive.reload();
        return;
      }

      // 마지막 쪽을 통째로 지웠으면 앞 쪽으로 — 빈 목록만 남으면 뭘 봤는지 알 수 없다
      const next = pageAfterDelete({
        page: archive.filters.page,
        pageSize: PROBLEM_PAGE_SIZE,
        total: archive.total,
        deleted: ids.length,
      });
      if (next !== archive.filters.page) archive.patch({ page: next });
      else archive.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '지우지 못했어요.');
    } finally {
      setDeleting(false);
    }
  }, [archive, selection]);

  /**
   * 고른 문항에 문법 분류를 붙인다.
   *
   * 삭제와 같은 세대 검사를 둔다 — 창이 떠 있는 동안은 체크를 못 바꾸지만, 규약을 갈라 두면
   * 나중에 창을 모달이 아니게 바꿨을 때 조용히 어긋난다.
   * @param path - 고른 문법 경로
   * @returns 붙였으면 true (부르는 쪽이 창을 닫는다)
   */
  const applyGrammar = useCallback(async (path: string[]): Promise<boolean> => {
    const ids = selection.selectedVisible;
    const label = formatGrammarPath(path);
    if (ids.length === 0 || !label) return false;

    const target = targetSeq.current;
    setTagging(true);
    try {
      if (target !== targetSeq.current) {
        toast.info('선택이 바뀌어 멈췄어요. 다시 눌러 주세요.');
        return false;
      }
      // 고른 경로 **하나만** 붙인다 — 아래 경로로 펴는 것은 찾을 때 하는 일이다
      const changed = await addGrammarPaths(ids, [label]);
      if (!aliveRef.current) return false;

      // 이미 붙어 있던 문항은 세지 않는다(RPC 가 실제로 바뀐 행만 돌려준다) —
      // 개수를 부풀리면 "붙었나?" 하고 다시 누르게 된다
      toast.success(changed > 0
        ? `${changed}개 문항에 '${label}' 을 붙였어요.`
        : '이미 다 붙어 있어요.');
      selection.exit();
      archive.reload();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '붙이지 못했어요.');
      return false;
    } finally {
      setTagging(false);
    }
  }, [archive, selection]);

  return {
    selection, deleting, tagging, patch, reset, toggleOne, toggleAll, bulkDelete, applyGrammar,
  };
}
