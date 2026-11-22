'use client';

import Link from 'next/link';
import { ItemNo } from '@/components/magazine';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  REPORT_CATEGORY_LABELS, REPORT_STATUS_LABELS, reportExcerpt, reportPlaceLabel,
  type ProblemReport, type ReportStatus,
} from '@/lib/problem-report/types';

interface ProblemReportRowProps {
  report: ProblemReport;
  n: number;
  /** 신고한 선생님 이름 */
  reporter?: string;
  /** 문항의 출처 id — '시험지에서 보기' 링크 */
  sourceId?: string;
  /** 원장이면 처리 단추를 그린다 */
  onResolve?: (status: ReportStatus) => void;
}

/**
 * 오류 신고 한 줄 — 종류 · 자리(문제지 제목과 번호) · 출처 · 발문 앞부분 · 신고 내용 · 신고한 선생님 · 날짜.
 *
 * 문항 링크(편집 · 시험지에서 보기)는 모두에게 보인다 — 문항 고치기는 선생님도 할 수 있다(sql/17 문항 정책).
 * 처리(고침·반려·다시 열기)는 원장에게만 그린다(권위는 DB 의 RPC). 문항이 지워졌거나 다시 올라왔으면 링크 대신
 * 그 사실을 적는다 — 신고 때의 모습(스냅샷)은 남아 있다. 줄 안에 테두리 상자를 두지 않고 단추는 늘 보인다(0.9.89).
 */
export default function ProblemReportRow({ report, n, reporter, sourceId, onResolve }: ProblemReportRowProps) {
  const excerpt = reportExcerpt(report.snapshot);
  const closed = report.status !== 'open';
  return (
    <li className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-2">
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <ItemNo n={n} />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[15px] leading-snug font-semibold break-keep [overflow-wrap:anywhere] text-ink">
            <Badge variant="warn" className="mr-2 align-middle">{REPORT_CATEGORY_LABELS[report.category] ?? report.category}</Badge>
            {reportPlaceLabel(report)}
            {closed && (
              <Badge variant={report.status === 'fixed' ? 'ok' : 'muted'} className="ml-2 align-middle">
                {REPORT_STATUS_LABELS[report.status]}
              </Badge>
            )}
            {!report.notified_at && <Badge variant="muted" className="ml-2 align-middle">알림 안 감</Badge>}
          </p>
          {report.source_label && (
            <p className="text-xs break-keep [overflow-wrap:anywhere] text-gray-500">{report.source_label}</p>
          )}
          {excerpt && <p className="text-xs break-keep [overflow-wrap:anywhere] text-gray-500">{excerpt}</p>}
          {report.note && (
            <p className="text-sm whitespace-pre-wrap break-keep [overflow-wrap:anywhere] text-gray-800">{report.note}</p>
          )}
          {closed && report.resolution_note && (
            <p className="text-xs break-keep [overflow-wrap:anywhere] text-gray-600">처리 메모 · {report.resolution_note}</p>
          )}
          <p className="text-xs text-gray-500">
            {reporter ? `${reporter} 선생님 · ` : ''}{new Date(report.created_at).toLocaleDateString('ko-KR')}
          </p>
          <p className="flex flex-wrap gap-3 text-sm">
            {report.problem_id ? (
              <>
                <Link href={`/problems/edit/${report.problem_id}`} className="text-primary underline underline-offset-2">문항 편집</Link>
                {sourceId && (
                  <Link href={`/problems/sources/${sourceId}?item=${report.problem_id}`} className="text-primary underline underline-offset-2">
                    시험지에서 보기
                  </Link>
                )}
              </>
            ) : (
              <span className="text-xs text-gray-400">문항이 지워졌거나 다시 올라왔어요 — 위는 신고 때의 모습이에요.</span>
            )}
          </p>
        </div>
      </div>
      {onResolve && (
        <div className="flex shrink-0 gap-1 pl-9 sm:pl-0">
          {closed ? (
            <Button type="button" size="sm" variant="outline" onClick={() => onResolve('open')}>다시 열기</Button>
          ) : (
            <>
              <Button type="button" size="sm" onClick={() => onResolve('fixed')}>고침</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => onResolve('rejected')}>반려</Button>
            </>
          )}
        </div>
      )}
    </li>
  );
}
