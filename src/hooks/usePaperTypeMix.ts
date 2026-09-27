'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { toProblemQuery, type ProblemFilters } from '@/lib/problem-bank/filters';
import { fetchProblemsByIdsForAdd, fetchTypeMixPool } from '@/lib/problem-bank/type-mix-queries';
import {
  countUnaddedByKind, planTypeMix, poolTooBigMessage, sampleTypeMix,
  TYPE_MIX_POOL_MAX, type TypeMixRow,
} from '@/lib/problem-paper/type-mix';
import type { ArchiveRow } from './useProblemArchive';

/** 이 훅이 쓰는 목록 화면의 상태 */
interface ArchiveLike {
  filters: ProblemFilters;
  total: number;
}

/** 이 훅이 쓰는 캔버스의 상태 */
interface ComposerLike {
  /** 이미 담긴 문항 id — 뽑기에서 뺀다 */
  added: ReadonlySet<string>;
  /** '비우기' 세대 — 오래 걸리는 담기가 돌아와서 견준다 */
  clearSeq: () => number;
}

/** 이 훅이 쓰는 담기 훅(`usePaperBulkAdd`)의 일부 */
interface BulkLike {
  addRows: (rows: readonly ArchiveRow[]) => boolean;
  filterSeq: () => number;
  lock: { acquire: () => boolean; release: () => void };
}

/** 창이 확정할 때 넘기는 값 */
export interface TypeMixRequest {
  total: number;
  objectivePercent: number;
}

/**
 * 문제지 조합 화면의 **유형 비율로 담기**.
 *
 * 폴더 담기(`usePaperBulkAdd.addFolder`)와 같은 자리에서 시작하지만 두 걸음이다:
 *  1. 창을 열 때 조건에 걸린 문항의 **가벼운 풀**을 받아 갈래별로 몇 개가 남았는지 보여 준다.
 *  2. 확정하면 그 풀에서 비율만큼 뽑아 **id 로 되읽어** 담는다.
 *
 * ⚠️ 잠금·세대 검사는 폴더 담기와 **같은 규약**이다 — 잠금은 그 훅의 것을 받아 쓰고
 *    (셋이 같은 캔버스를 채운다), 조건 세대는 창을 **열 때** 잡아 둔다.
 * ⚠️ 효과 안에서 동기 setState 를 하지 않는다(`set-state-in-effect`) — 조회 결과는
 *    전부 `.then` 안에서 넣는다.
 * @param archive - 목록 상태
 * @param paper - 캔버스 상태
 * @param bulk - 담기 훅 (토스트·잠금·세대를 나눠 쓴다)
 * @returns 창 상태와 열기·닫기·확정
 */
export function usePaperTypeMix(archive: ArchiveLike, paper: ComposerLike, bulk: BulkLike) {
  const [open, setOpen] = useState(false);
  /** 창을 연 횟수 — 폼을 다시 마운트하는 key 다(열 때마다 기본값으로 돌아간다) */
  const [session, setSession] = useState(0);
  const [pool, setPool] = useState<TypeMixRow[] | null>(null);
  const [poolError, setPoolError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** 창을 열 때의 조건 세대 — 담을 때 그대로인지 견준다 */
  const askedSeq = useRef(0);
  /** 늦게 온 풀 조회를 버리려고 — 창을 닫았다 다시 연 사이의 응답은 남의 것이다 */
  const sessionRef = useRef(0);
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  /** 창을 열고 풀을 읽는다 */
  const openDialog = useCallback(() => {
    // 조건에 걸린 것이 너무 많으면 열지 않는다 — 조용히 잘린 목록으로 뽑으면 안 된다
    const tooBig = poolTooBigMessage(archive.total);
    if (tooBig) { toast.error(tooBig); return; }

    sessionRef.current += 1;
    const mySession = sessionRef.current;
    askedSeq.current = bulk.filterSeq();
    setSession(mySession);
    setPool(null);
    setPoolError(null);
    setOpen(true);

    fetchTypeMixPool(toProblemQuery(archive.filters), TYPE_MIX_POOL_MAX)
      .then((page) => {
        if (!aliveRef.current || sessionRef.current !== mySession) return;
        // 받아 오는 사이 늘었다면(다른 선생님의 업로드) 앞에서 잘린 목록이다
        const grew = poolTooBigMessage(page.total);
        if (grew) { setPoolError(grew); return; }
        setPool(page.rows);
      })
      .catch((e: unknown) => {
        if (!aliveRef.current || sessionRef.current !== mySession) return;
        setPoolError(e instanceof Error ? e.message : '문항을 불러오지 못했어요.');
      });
  }, [archive.filters, archive.total, bulk]);

  /**
   * 창을 닫는다 — **진행 중인 담기의 취소이기도 하다**.
   *
   * ⚠️ 창 오른쪽 위 X·Escape·바깥 누르기는 담는 중에도 눌린다. 그때 그냥 닫기만 하면
   *    조회가 끝난 뒤 **닫은 창의 문항이 캔버스에 담긴다**(코덱스 정지 게이트).
   *    닫는 길을 전부 막는 안은 버렸다 — 조회가 멎으면 창이 영영 안 닫힌다
   *    (`authFetch` 에 타임아웃이 없다, CLAUDE.md 의 concept-pick 3~4R 과 같은 자리).
   *    세대를 올려 **돌아온 결과를 버리는** 쪽이 안전하다(읽기라 부작용이 없다).
   */
  const close = useCallback(() => {
    sessionRef.current += 1;
    setOpen(false);
  }, []);

  /** 비율대로 뽑아 담는다 */
  const confirm = useCallback(async ({ total, objectivePercent }: TypeMixRequest) => {
    if (!pool) return;
    // 잠금은 첫 await 앞에서 건다 — 폴더·지문 담기와 하나를 나눠 쓴다
    if (!bulk.lock.acquire()) return;
    setBusy(true);
    const mySession = sessionRef.current;
    const askedClear = paper.clearSeq();
    try {
      // 창을 열어 둔 사이 다른 폴더를 눌렀다 — 보이는 것과 다른 것을 담으면 안 된다
      if (bulk.filterSeq() !== askedSeq.current) {
        toast.error('고른 폴더가 바뀌어 담지 않았어요. 창을 닫고 다시 열어 주세요.');
        return;
      }
      const plan = planTypeMix(total, objectivePercent, countUnaddedByKind(pool, paper.added));
      const picks = sampleTypeMix(pool, plan.take, paper.added);
      if (picks.length === 0) { toast.error('담을 문항이 없어요.'); return; }

      const rows = await fetchProblemsByIdsForAdd(picks.map((p) => p.id));
      if (!aliveRef.current) return;
      // 되읽는 사이 창을 닫았다(X·Escape·바깥 누르기) — 닫은 것은 취소라는 뜻이다
      if (sessionRef.current !== mySession) {
        toast.error('창을 닫아서 담지 않았어요.');
        return;
      }
      // ⚠️ 되읽는 **사이**에도 조건이 바뀔 수 있다 — 창이 모달이라 드문 자리지만, 그때 담으면
      //    옛 폴더에서 뽑은 문항이 들어간다. 폴더 담기가 조회 앞뒤로 두 번 보는 것과 같은 규약
      //    (코덱스 1R)
      if (bulk.filterSeq() !== askedSeq.current) {
        toast.error('담는 사이에 고른 폴더가 바뀌어 담지 않았어요. 창을 닫고 다시 열어 주세요.');
        return;
      }
      // 담는 사이 '비우기' 를 눌렀다 — 방금 비운 캔버스를 도로 채우면 안 된다
      if (paper.clearSeq() !== askedClear) {
        toast.error('담는 사이에 캔버스를 비워서 담지 않았어요.');
        return;
      }
      // 토스트는 `addRows` 한 곳이다. 상한에 막히면 false 라 창을 열어 둔다
      if (bulk.addRows(rows)) setOpen(false);
    } catch (e) {
      if (aliveRef.current) toast.error(e instanceof Error ? e.message : '담지 못했어요.');
    } finally {
      bulk.lock.release();
      if (aliveRef.current) setBusy(false);
    }
  }, [bulk, paper, pool]);

  return { open, session, pool, poolError, busy, openDialog, close, confirm };
}
