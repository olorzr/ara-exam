'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReportState, ReportStateSubject } from '@/lib/problem-report/display';
import { fetchReportState } from '@/lib/problem-report/queries';

/** 읽기 결과 — 어느 요청의 결과인지와 한 덩어리로 든다(대상을 바꾸거나 다시 읽는 동안 옛 결과를 내주지 않게) */
type StateRead =
  | { request: string; status: 'ok'; state: ReportState }
  | { request: string; status: 'failed' };

/** 훅이 돌려주는 값 */
export interface ReportStateView {
  /** 지금 요청의 상태(읽는 중·실패·대상 없음이면 null) */
  state: ReportState | null;
  loading: boolean;
  failed: boolean;
  /** 다시 읽는다 — 신고가 '바뀌었어요' 로 거절됐을 때·실패 뒤 다시 시도 */
  reload: () => void;
}

/**
 * 대상의 열쇠 — 문항과 문제지 항목이 같은 id 를 가져도 갈리게 접두를 단다.
 * @param subject - 대상
 * @returns 열쇠
 */
function subjectKey(subject: ReportStateSubject): string {
  return 'problemId' in subject ? `problem:${subject.problemId}` : `item:${subject.paperItemId}`;
}

/**
 * 신고 창의 '굳힐 상태'(태그·출처·원래 번호·지문) — 태그·출처 신고일 때만 읽는다(sql/114).
 *
 * 결과는 **요청 하나**에 묶는다(코덱스 5R) — 종류를 바꿨다 돌아오거나 다시 읽으면 새 요청이고, 그 요청이 끝날 때까지는
 * 읽는 중이다. 같은 대상의 옛 실패를 내주면 지문 없이 신고할 수 있는 틈이 생긴다.
 * @param subject - 문제 은행 문항 또는 문제지 항목(없으면 null)
 * @param enabled - 읽을지(태그·출처 종류를 골랐을 때)
 * @returns 상태·읽는 중·실패·다시 읽기
 */
export function useReportState(subject: ReportStateSubject | null, enabled: boolean): ReportStateView {
  const [read, setRead] = useState<StateRead | null>(null);
  const [generation, setGeneration] = useState(0);
  // 다시 켜질 때마다 새 요청 — 렌더 중 파생 상태로 센다(효과 안에서 상태를 바꾸지 않는다)
  const [seenEnabled, setSeenEnabled] = useState(enabled);
  if (seenEnabled !== enabled) {
    setSeenEnabled(enabled);
    if (enabled) setGeneration((n) => n + 1);
  }

  const key = subject ? subjectKey(subject) : null;
  const request = key && enabled ? `${key}#${generation}` : null;
  const problemId = subject && 'problemId' in subject ? subject.problemId : null;
  const paperItemId = subject && 'paperItemId' in subject ? subject.paperItemId : null;

  useEffect(() => {
    if (!request) return;
    let alive = true;
    const target: ReportStateSubject | null = problemId ? { problemId } : paperItemId ? { paperItemId } : null;
    if (!target) return;
    fetchReportState(target)
      .then((state) => { if (alive) setRead({ request, status: 'ok', state }); })
      .catch(() => { if (alive) setRead({ request, status: 'failed' }); });
    return () => { alive = false; };
  }, [request, problemId, paperItemId]);

  const reload = useCallback(() => setGeneration((n) => n + 1), []);

  const mine = request && read?.request === request ? read : null;
  return {
    state: mine?.status === 'ok' ? mine.state : null,
    loading: Boolean(request && !mine),
    failed: mine?.status === 'failed',
    reload,
  };
}
