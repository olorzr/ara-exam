'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { deleteSource } from '@/lib/problem-bank/mutations-source';
import { countPapersUsing } from '@/lib/problem-bank/mutations';
import { countSourceProblems, fetchSourceProblemIds } from '@/lib/problem-bank/source-list';
import { sourceDeleteConfirmMessage } from '@/lib/problem-bank/source-delete';
import type { ProblemSource } from '@/types/problem-bank';

/**
 * 출처 하나를 지우는 흐름 — 목록과 검수 화면이 함께 쓴다.
 *
 * 두 화면이 같은 일을 하고 뒷정리만 다르다(목록은 목록을 다시 읽고, 검수 화면은 목록으로
 * 돌아간다). 그래서 뒷정리만 `onDeleted` 로 받는다.
 *
 * **`useReviewGuards` 에 넣지 않았다.** 그쪽은 저장하지 않은 수정을 지키는 것이 일이라
 * `review` 와 `dirtyIds` 를 요구하는데 목록 화면에는 둘 다 없다.
 *
 * 미저장 수정 확인도 **일부러 하지 않는다.** 어차피 출처를 통째로 버리는 참이고,
 * 되돌릴 수 없는 확인창 위에 확인창을 하나 더 얹으면 읽지 않고 누르게 된다.
 */

/** 지운 뒤의 뒷정리. 목록 다시 읽기처럼 기다려야 하는 일이면 Promise 를 돌려준다 */
export type OnSourceDeleted = (id: string) => void | Promise<void>;

/**
 * 출처 삭제 훅.
 * @param onDeleted - 지운 뒤 화면이 할 뒷정리 (지운 출처 id 를 받는다)
 * @returns 지우는 중인 출처 id 와 삭제를 시작하는 함수
 */
export function useSourceDelete(onDeleted: OnSourceDeleted) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /**
   * 진행 중 잠금.
   *
   * ⚠️ state 가 아니라 ref 다 — 같은 실행 흐름에서 두 번 부르면 state 는 아직 안 바뀌어
   *    있어 두 번째 호출이 그대로 통과한다. 화면의 `disabled` 는 렌더 뒤에나 걸린다.
   */
  const busyRef = useRef(false);

  /**
   * 화면이 아직 붙어 있는가.
   *
   * ⚠️ 마운트할 때 **반드시 다시 true 로 되돌린다.** StrictMode 는 마운트 → 언마운트 →
   *    재마운트라, 정리에서 false 로만 두면 재마운트 뒤 삭제가 통째로 먹통이 된다.
   */
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  const requestDelete = useCallback(async (source: ProblemSource) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setDeletingId(source.id);
    try {
      // 확인창에 적을 두 숫자를 먼저 센다 — 문제지에 담긴 출처인지 모르고 지우면
      // "인쇄물이 망가졌나" 를 나중에 혼자 걱정하게 된다.
      // 문항 수는 정확히 세고(countSourceProblems), 문제지 수는 안심시키려는 말이라
      // 1,000문항까지만 본다(fetchSourceProblemIds 주석 참조)
      const [problemCount, problemIds] = await Promise.all([
        countSourceProblems(source.id),
        fetchSourceProblemIds(source.id),
      ]);
      const paperCount = await countPapersUsing(problemIds);
      // 묻는 사이에 화면을 떠났으면 확인창을 띄우지 않는다
      if (!aliveRef.current) return;

      const ok = window.confirm(sourceDeleteConfirmMessage({
        title: source.title,
        status: source.status,
        problemCount,
        paperCount,
      }));
      if (!ok) return;

      await deleteSource(source.id);
      toast.success('출처를 지웠어요.');

      // ⚠️ 지우는 사이에 화면을 떠났으면 **뒷정리를 하지 않는다** — 이미 다른 메뉴를
      //    보고 있는 사람을 목록으로 끌고 가거나, 사라진 화면의 목록을 다시 읽게 된다.
      //    삭제 자체는 끝났으므로 알림은 그대로 띄운다.
      if (!aliveRef.current) return;
      // 목록 다시 읽기가 끝날 때까지 잠금을 풀지 않는다 — 먼저 풀면 그 사이 '더 보기'가
      // 끼어들어 서로의 응답을 덮어쓴다
      await onDeleted(source.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '지우지 못했어요.');
    } finally {
      busyRef.current = false;
      setDeletingId(null);
    }
  }, [onDeleted]);

  return { deletingId, requestDelete };
}
