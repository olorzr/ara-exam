'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { fetchProblemReports, fetchProblemSourceIds, resolveProblemReport } from '@/lib/problem-report/queries';
import type { ProblemReport, ReportStatus } from '@/lib/problem-report/types';

/** 오류 신고 목록 탭 */
export type ReportTab = 'open' | 'closed';

/** 읽어 둔 목록 — 어느 탭의 것인지와 함께 든다 */
interface LoadedReports {
  tab: ReportTab;
  reports: ProblemReport[];
  sourceIds: ReadonlyMap<string, string>;
}

/**
 * 오류 신고 목록(접수 중 / 처리됨) + 원장 처리.
 *
 * 로딩은 '어느 탭의 목록을 읽어 두었는가' 에서 파생한다(usePaperList 와 같은 결) — 탭을 바꾼 직후 옛 탭 목록이
 * 보이지 않고, 늦게 온 옛 응답은 버린다. 처리하면 누른 탭에서 그 줄을 바로 빼고 **지금 탭을 다시 읽는다** —
 * 응답 전에 탭을 바꿨으면 새 탭은 처리 전 목록을 읽었거나 읽는 중일 수 있다(그 읽기는 버린다, 코덱스 2R).
 * 다시 읽는 동안은 보던 목록을 그대로 두고, 다시 읽기가 실패해도 지킨다.
 * 처리 권한은 DB 가 정한다(sql/113 — 원장 이메일). 화면은 원장에게만 단추를 그린다.
 * @param tab - 접수 중 / 처리됨
 * @returns 목록·출처 id 지도·로딩·처리·다시 읽기
 */
export function useProblemReports(tab: ReportTab) {
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState<LoadedReports | null>(null);

  useEffect(() => {
    let alive = true;
    fetchProblemReports(tab)
      .then(async (reports) => {
        const sourceIds = await fetchProblemSourceIds(reports.flatMap((r) => (r.problem_id ? [r.problem_id] : [])));
        if (alive) setLoaded({ tab, reports, sourceIds });
      })
      .catch((e) => {
        if (!alive) return;
        toast.error(e instanceof Error ? e.message : '오류 신고를 불러오지 못했어요.');
        setLoaded((prev) => (prev && prev.tab === tab ? prev : { tab, reports: [], sourceIds: new Map() }));
      });
    return () => { alive = false; };
  }, [tab, version]);

  const resolve = useCallback(async (report: ProblemReport, status: ReportStatus, note = '') => {
    // 누른 탭의 목록에서만 바로 뺀다 — 응답 전에 탭을 바꾸면 새 탭은 이미 처리된 행을 읽어 왔을 수 있다(코덱스 1R)
    const origin = tab;
    try {
      await resolveProblemReport(report.id, status, note);
      setLoaded((prev) => (prev && prev.tab === origin
        ? { ...prev, reports: prev.reports.filter((r) => r.id !== report.id) }
        : prev));
      setVersion((n) => n + 1);
      toast.success(status === 'open' ? '다시 접수 중으로 돌렸어요.' : status === 'fixed' ? '고침으로 표시했어요.' : '반려로 표시했어요.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '처리하지 못했어요.');
    }
  }, [tab]);

  const reload = useCallback(() => setVersion((n) => n + 1), []);
  const current = loaded?.tab === tab ? loaded : null;
  return {
    reports: current?.reports ?? [],
    sourceIds: current?.sourceIds ?? new Map<string, string>(),
    loading: current === null,
    resolve,
    reload,
  };
}
