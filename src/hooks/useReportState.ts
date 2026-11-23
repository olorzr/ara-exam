'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReportState } from '@/lib/problem-report/display';
import { fetchReportState } from '@/lib/problem-report/queries';

/** 지금 상태 읽기 결과 — 어느 문항의 결과인지와 한 덩어리로 든다(문항을 바꾼 직후 옛 문항의 지문을 새 문항에 싣지 않게) */
type StateRead =
  | { problemId: string; status: 'ok'; state: ReportState }
  | { problemId: string; status: 'failed' };

/** 훅이 돌려주는 값 */
export interface ReportStateView {
  /** 지금 문항의 상태(읽는 중·실패·문항 없음이면 null) */
  state: ReportState | null;
  loading: boolean;
  failed: boolean;
  /** 다시 읽는다 — 신고가 '바뀌었어요' 로 거절됐을 때·실패 뒤 다시 시도 */
  reload: () => void;
}

/**
 * 신고 창의 '지금 상태'(태그·출처·지문) — 태그·출처 신고일 때만 읽는다(sql/114).
 * @param problemId - 문항 id(문제지 항목의 원본이 없으면 null)
 * @param enabled - 읽을지(태그·출처 종류를 골랐을 때)
 * @returns 상태·읽는 중·실패·다시 읽기
 */
export function useReportState(problemId: string | null, enabled: boolean): ReportStateView {
  const [read, setRead] = useState<StateRead | null>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!problemId || !enabled) return;
    let alive = true;
    fetchReportState(problemId)
      .then((state) => { if (alive) setRead({ problemId, status: 'ok', state }); })
      .catch(() => { if (alive) setRead({ problemId, status: 'failed' }); });
    return () => { alive = false; };
  }, [problemId, enabled, round]);

  const reload = useCallback(() => {
    setRead(null);
    setRound((n) => n + 1);
  }, []);

  const mine = problemId && enabled && read?.problemId === problemId ? read : null;
  return {
    state: mine?.status === 'ok' ? mine.state : null,
    loading: Boolean(problemId && enabled && !mine),
    failed: mine?.status === 'failed',
    reload,
  };
}
