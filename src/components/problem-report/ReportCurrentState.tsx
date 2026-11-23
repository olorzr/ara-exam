'use client';

import { Button } from '@/components/ui/button';
import { reportTagLines } from '@/lib/problem-report/display';
import { sourceLabelWithNumber } from '@/lib/problem-bank/source-label';
import type { ReportStateView } from '@/hooks/useReportState';

interface ReportCurrentStateProps {
  /** 태그 신고면 태그 넷, 출처 신고면 출처 줄 */
  kind: 'tag' | 'source';
  view: ReportStateView;
}

/**
 * 태그·출처 신고 창의 '지금 붙은 값' — 신고하면 이 값이 '신고 때 태그'·출처로 남는다(sql/114).
 * 문제 은행 상세 창은 문법 태그를 보여 주지 않아, 무엇이 저장될지 여기서 확인한다(코덱스 4R).
 * 읽지 못해도 신고는 막지 않는다(그때는 저장 순간의 값이 남는다).
 */
export default function ReportCurrentState({ kind, view }: ReportCurrentStateProps) {
  const title = kind === 'tag' ? '지금 붙은 태그' : '신고될 출처';
  if (view.loading) return <p className="text-xs text-gray-400">{title}를 불러오는 중…</p>;
  if (view.failed || !view.state) {
    return (
      <p className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        {title}를 불러오지 못했어요. 신고는 할 수 있어요.
        <Button type="button" variant="outline" size="sm" onClick={view.reload}>다시 불러오기</Button>
      </p>
    );
  }
  const { tags, source, number } = view.state;
  if (kind === 'tag' && !tags) {
    return <p className="text-xs text-gray-500">원본 문항이 지워져 지금 붙은 태그가 없어요. 무엇이 틀렸는지 내용에 적어 주세요.</p>;
  }
  const lines = kind === 'tag'
    ? reportTagLines(tags ?? { work_titles: [], unit_path: [], area_path: [], grammar_paths: [] }).map((l) => `${l.label} ${l.value}`)
    : [source ? sourceLabelWithNumber(source, number) : ''].filter(Boolean);
  return (
    <div className="rounded-md bg-gray-50 px-3 py-2 text-xs break-keep [overflow-wrap:anywhere] text-gray-700" aria-live="polite">
      <p className="font-semibold">{title}</p>
      {lines.length === 0 ? (
        <p className="text-gray-500">{kind === 'tag' ? '붙은 태그가 없어요.' : '출처가 비어 있어요.'}</p>
      ) : (
        lines.map((line) => <p key={line}>{line}</p>)
      )}
    </div>
  );
}
