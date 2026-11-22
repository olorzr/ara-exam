'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageTitle, PaperList } from '@/components/magazine';
import ProblemReportRow from '@/components/problem-report/ProblemReportRow';
import { useCreatorNames } from '@/hooks/useCreatorNames';
import { useOwnerAccess } from '@/hooks/useOwnerAccess';
import { useProblemReports, type ReportTab } from '@/hooks/useProblemReports';
import { REPORT_LIST_LIMIT } from '@/lib/problem-report/queries';

const TABS: { value: ReportTab; label: string; empty: string }[] = [
  { value: 'open', label: '접수 중', empty: '접수 중인 신고가 없어요.' },
  { value: 'closed', label: '처리됨', empty: '처리한 신고가 아직 없어요.' },
];

/**
 * 문제 은행 오류 신고 목록 (`/problems/reports`, 2026-11-22).
 *
 * 선생님이 문제지 보기 화면이나 문제 은행 상세 창에서 신고한 것이 모인다 — 선생님 모두 보고(이미 신고됐는지·고쳐졌는지),
 * 처리(고침·반려)는 원장님만 한다(sql/113). 신고가 들어오면 원장님께 웍스로 알린다(알림이 못 간 줄은 '알림 안 감').
 */
export default function ProblemReportsPage() {
  const [tab, setTab] = useState<ReportTab>('open');
  const { reports, sourceIds, loading, resolve } = useProblemReports(tab);
  const { isOwner } = useOwnerAccess();
  const names = useCreatorNames(reports.map((r) => r.user_id));
  const empty = TABS.find((t) => t.value === tab)?.empty ?? '';

  return (
    <div className="space-y-4">
      <div className="border-b-2 border-ink pb-3">
        <PageTitle eyebrow="PROBLEM BANK">오류 신고</PageTitle>
        <p className="mt-1 text-sm text-gray-500">
          문제지를 풀리다 찾은 오류예요. 문제지 화면의 &lsquo;오류 신고&rsquo; 단추나 문제 아카이브 문항 상세 창에서 신고하면
          여기에 모이고 원장님께 바로 알려요. 고친 내용은 새로 만드는 문제지부터 반영돼요.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => { if (v === 'open' || v === 'closed') setTab(v); }}>
        <TabsList>
          {TABS.map((t) => <TabsTrigger key={t.value} value={t.value} className="px-3">{t.label}</TabsTrigger>)}
        </TabsList>
        {TABS.map((t) => (
          <TabsContent key={t.value} value={t.value}>
            {t.value !== tab ? null : loading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
              </div>
            ) : reports.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-sm text-gray-500">{empty}</CardContent></Card>
            ) : (
              <>
                <PaperList aria-label={`오류 신고 ${t.label}`}>
                  {reports.map((report, index) => (
                    <ProblemReportRow
                      key={report.id}
                      report={report}
                      n={index + 1}
                      reporter={names.get(report.user_id)}
                      sourceId={report.problem_id ? sourceIds.get(report.problem_id) : undefined}
                      onResolve={isOwner ? (status) => resolve(report, status) : undefined}
                    />
                  ))}
                </PaperList>
                {reports.length >= REPORT_LIST_LIMIT && (
                  <p className="mt-2 text-xs text-gray-400">최근 {REPORT_LIST_LIMIT}건만 보여요.</p>
                )}
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
