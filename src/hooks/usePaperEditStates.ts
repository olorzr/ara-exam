'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchPaperEditStates, type PaperEditState } from '@/lib/problem-paper/paper-edit';

/** 렌더마다 새 지도를 만들지 않게 */
const NO_STATES: ReadonlyMap<string, PaperEditState> = new Map();

interface Settled {
  /** 어느 목록의 결과인가 — 같은 목록을 다시 물을 때는 앞 결과를 지킨다 */
  idList: string;
  /** 어느 물음(목록 + 다시 묻기 열쇠)의 결과인가 */
  key: string;
  states: ReadonlyMap<string, PaperEditState>;
  /** 이 물음이 실패했는가(그때 `states` 는 같은 목록의 마지막으로 알던 값) */
  failed: boolean;
}

/** 고치기 상태 묻기의 결과 */
export interface PaperEditStatesResult {
  /** 문제지 id → 상태. 같은 목록이면 다시 묻는 동안·실패한 뒤에도 마지막으로 알던 값을 지킨다 */
  states: ReadonlyMap<string, PaperEditState>;
  /** 마지막 물음이 실패했다 — '성적 반영 대기' 를 확인하지 못했다는 뜻이기도 하다 */
  failed: boolean;
}

/**
 * 문제지들을 지금 사람이 고칠 수 있는지 — 목록의 연필 단추와 보기 화면의 '수정' 단추가 쓴다.
 *
 * ⚠️ **같은 목록을 다시 물을 때(다시 묻기 열쇠만 바뀜) 앞 결과를 지운 채 기다리지 않고, 실패해도 지우지 않는다**(코덱스 2R).
 *    지우면 '성적 반영 대기' 경고가 그 사이·실패한 뒤 사라진다 — DB 의 표시는 그대로인데 화면만 '괜찮다' 고 말하게 된다.
 *    처음부터 못 읽었으면 빈 지도다(고칠 수 있다고 짐작하지 않는다) — 그때는 `failed` 로 '확인하지 못했다' 를 알린다.
 * @param paperIds - 문제지 id 들
 * @param refreshKey - 바뀌면 다시 묻는다(성적에 다시 등록한 뒤 등)
 * @returns 상태와 실패 여부
 */
export function usePaperEditStates(paperIds: readonly string[], refreshKey = 0): PaperEditStatesResult {
  const idList = useMemo(() => [...new Set(paperIds)].join(','), [paperIds]);
  const key = `${idList}#${refreshKey}`;
  const [settled, setSettled] = useState<Settled | null>(null);

  useEffect(() => {
    // 열쇠 하나에서 다시 꺼낸다 — 배열을 의존성에 두면 렌더마다 새 배열이라 끝없이 묻는다
    const ids = idList.split(',').filter(Boolean);
    if (ids.length === 0) return undefined;
    let alive = true;
    fetchPaperEditStates(ids)
      .then((states) => { if (alive) setSettled({ idList, key, states, failed: false }); })
      .catch(() => {
        if (!alive) return;
        setSettled((prev) => ({
          idList, key, failed: true,
          states: prev && prev.idList === idList ? prev.states : NO_STATES,
        }));
      });
    return () => { alive = false; };
  }, [idList, key]);

  const sameList = settled !== null && settled.idList === idList;
  return {
    states: sameList ? settled.states : NO_STATES,
    failed: sameList && settled.key === key && settled.failed,
  };
}
