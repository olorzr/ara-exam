'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchPaperEditStates, fetchPaperForEdit, type PaperEditData, type PaperEditState,
} from '@/lib/problem-paper/paper-edit';

/** 고치기 화면이 읽은 결과 */
export type PaperEditLoad =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: PaperEditData; state: PaperEditState };

/** 상태 RPC 가 이 문제지를 빠뜨렸을 때 — 고칠 수 있다고 짐작하지 않는다 */
const UNKNOWN_STATE: PaperEditState = { reason: 'grade_check_failed', inBook: false, pending: false, workbook: false };

interface Settled {
  paperId: string;
  round: number;
  value: PaperEditLoad;
}

/**
 * 고칠 문제지와 '지금 사람이 고칠 수 있는가' 를 함께 읽는다.
 *
 * 읽은 결과는 **어느 문제지 · 몇 번째 읽기의 것인지**와 함께 든다 — 다시 읽는 중에 옛 결과를 새 것처럼 내주지 않게
 * (아카이브 목록과 같은 규약). `version` 은 다 읽을 때마다 바뀐다 — 화면이 그 값을 `key` 로 써서 캔버스를 새로 연다.
 * @param paperId - 문제지 id
 * @returns 읽은 결과 · 버전 · 다시 읽기
 */
export function usePaperEditLoad(paperId: string) {
  const [round, setRound] = useState(0);
  const [settled, setSettled] = useState<Settled | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      let value: PaperEditLoad;
      try {
        const [data, states] = await Promise.all([fetchPaperForEdit(paperId), fetchPaperEditStates([paperId])]);
        value = data ? { status: 'ready', data, state: states.get(paperId) ?? UNKNOWN_STATE } : { status: 'missing' };
      } catch (e) {
        value = { status: 'error', message: e instanceof Error && e.message ? e.message : '문제지를 불러오지 못했어요.' };
      }
      if (alive) setSettled({ paperId, round, value });
    })();
    return () => { alive = false; };
  }, [paperId, round]);

  const reload = useCallback(() => setRound((r) => r + 1), []);
  const current = settled && settled.paperId === paperId && settled.round === round ? settled.value : null;
  return { load: current ?? ({ status: 'loading' } as const), version: `${paperId}:${round}`, reload };
}
