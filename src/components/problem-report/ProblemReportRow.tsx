'use client';

import Link from 'next/link';
import { ItemNo } from '@/components/magazine';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  parseReportTags, reportSourceDetail, reportSourceInput, reportSourceLabel, reportTagLines,
} from '@/lib/problem-report/display';
import {
  REPORT_CATEGORY_LABELS, REPORT_STATUS_LABELS, reportExcerpt, reportPlaceLabel, withOriginalNumber,
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
  const source = reportSourceLabel(report.snapshot?.source, report.source_label);
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
          {/* 문제지에서 신고한 건은 자리가 인쇄 번호라 원래 번호를 출처 줄에 붙인다(문제 은행 신고는 자리에 이미 있다) */}
          {source && (
            <p className="text-xs break-keep [overflow-wrap:anywhere] text-gray-500">
              {report.paper_title ? withOriginalNumber(source, report.snapshot?.number) : source}
            </p>
          )}
          {excerpt && <p className="text-xs break-keep [overflow-wrap:anywhere] text-gray-500">{excerpt}</p>}
          {report.category === 'tag' && <ReportTagsLine tags={report.tags} />}
          {report.category === 'source' && <ReportSourceFields source={report.snapshot?.source} />}
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

/**
 * 태그 신고의 '신고 때 태그' 줄 — 원장이 보기 전에 태그가 바뀌어도 선생님이 짚은 값이 남는다(sql/114).
 * @param props.tags - `problem_reports.tags`(jsonb)
 */
function ReportTagsLine({ tags }: { tags: unknown }) {
  const parsed = parseReportTags(tags);
  if (!parsed) {
    return <p className="text-xs text-gray-500">신고 때 태그는 남지 않았어요 — 원본 문항이 없었거나 예전 신고예요.</p>;
  }
  const lines = reportTagLines(parsed);
  if (lines.length === 0) return <p className="text-xs text-gray-500">신고 때 붙은 태그가 없었어요.</p>;
  return (
    <p className="text-xs break-keep [overflow-wrap:anywhere] text-gray-600">
      <span className="font-semibold text-gray-700">신고 때 태그</span>
      {lines.map((line) => <span key={line.label}> · {line.label} {line.value}</span>)}
    </p>
  );
}

/**
 * 출처 신고의 '신고 때 출처' 줄 — 신고 창이 보여 준 칸 전부(이름표와 함께, 스냅샷 출처). 위의 출처 줄은 모의고사면 제목뿐이라
 * 선생님이 짚은 학년·시험 칸이 안 보인다(코덱스 8R).
 * @param props.source - 신고 스냅샷의 출처
 */
function ReportSourceFields({ source }: { source: unknown }) {
  const input = reportSourceInput(source);
  const detail = input ? reportSourceDetail(input) : '';
  if (!detail) return <p className="text-xs text-gray-500">신고 때 출처 칸이 비어 있었어요.</p>;
  return (
    <p className="text-xs break-keep [overflow-wrap:anywhere] text-gray-600">
      <span className="font-semibold text-gray-700">신고 때 출처</span> · {detail}
    </p>
  );
}
