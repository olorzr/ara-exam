'use client';

import { Button } from '@/components/ui/button';
import { reportTagLines, type ReportState } from '@/lib/problem-report/display';
import { sourceLabelWithNumber } from '@/lib/problem-bank/source-label';
import type { ReportStateView } from '@/hooks/useReportState';

interface ReportCurrentStateProps {
  /** 고른 종류 — 그 종류의 값을 먼저 보여 준다 */
  kind: 'tag' | 'source';
  view: ReportStateView;
}

/**
 * 태그 줄 — 원본 문항이 지워진 문제지 항목이면 null(태그 없음).
 * @param state - 굳힐 상태
 * @returns 줄 글 목록 또는 null
 */
function tagLinesOf(state: ReportState): string[] | null {
  return state.tags ? reportTagLines(state.tags).map((l) => `${l.label} ${l.value}`) : null;
}

/**
 * 태그·출처 신고 창의 '신고에 남을 값' — 지금 붙은 태그와 신고될 출처(원래 번호까지)를 **둘 다** 보여 준다(sql/114).
 * 둘 다 신고에 저장되고 서버가 둘 다 대조하므로(코덱스 6R — 출처 신고가 화면에 없는 태그 변경으로 거절되면 무엇이 바뀌었는지
 * 못 본다) 고른 종류의 값을 먼저 둔다. 문제 은행 상세 창은 문법 태그를 보여 주지 않아 여기서 확인한다(코덱스 4R).
 * 읽지 못해도 신고는 막지 않는다(그때는 저장 순간의 값이 남는다).
 */
export default function ReportCurrentState({ kind, view }: ReportCurrentStateProps) {
  if (view.loading) return <p className="text-xs text-gray-400">신고에 남을 태그·출처를 불러오는 중…</p>;
  if (view.failed || !view.state) {
    return (
      <p className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        신고에 남을 태그·출처를 불러오지 못했어요. 신고는 할 수 있어요.
        <Button type="button" variant="outline" size="sm" onClick={view.reload}>다시 불러오기</Button>
      </p>
    );
  }
  const tags = tagLinesOf(view.state);
  const source = view.state.source ? sourceLabelWithNumber(view.state.source, view.state.number) : '';
  const tagBlock = (
    <div key="tag">
      <p className="font-semibold">지금 붙은 태그</p>
      {tags === null ? (
        <p className="text-gray-500">원본 문항이 지워져 지금 붙은 태그가 없어요. 무엇이 틀렸는지 내용에 적어 주세요.</p>
      ) : tags.length === 0 ? (
        <p className="text-gray-500">붙은 태그가 없어요.</p>
      ) : (
        tags.map((line) => <p key={line}>{line}</p>)
      )}
    </div>
  );
  const sourceBlock = (
    <div key="source">
      <p className="font-semibold">신고될 출처</p>
      <p className={source ? undefined : 'text-gray-500'}>{source || '출처가 비어 있어요.'}</p>
    </div>
  );
  return (
    <div className="space-y-1.5 rounded-md bg-gray-50 px-3 py-2 text-xs break-keep [overflow-wrap:anywhere] text-gray-700" aria-live="polite">
      {kind === 'tag' ? [tagBlock, sourceBlock] : [sourceBlock, tagBlock]}
    </div>
  );
}
