'use client';

import { Button } from '@/components/ui/button';
import { reportSourceInput } from '@/lib/problem-report/display';
import { sourceLabelWithNumber } from '@/lib/problem-bank/source-label';
import type { ReportStateView } from '@/hooks/useReportState';
import { ReportSourceFieldsView, ReportTagGroupsView } from './ReportValueParts';

interface ReportCurrentStateProps {
  /** 고른 종류 — 그 종류의 값을 먼저 보여 준다 */
  kind: 'tag' | 'source';
  view: ReportStateView;
}

/**
 * 태그·출처 신고 창의 '신고에 남을 값' — 지금 붙은 태그와 신고될 출처(원래 번호까지)를 **둘 다** 보여 준다(sql/114).
 * 둘 다 신고에 저장되고 서버가 둘 다 대조하므로(코덱스 6R) 고른 종류의 값을 먼저 둔다. 값은 서버가 정규화한 그대로이고
 * 칸마다 따로 그린다 — 지문이 다르면 화면도 다르다(Stop 게이트). 문제 은행 상세 창은 문법 태그를 보여 주지 않아 여기서 확인한다(4R).
 * 읽지 못해도 신고는 막지 않는다(그때는 저장 순간의 값이 남는다).
 */
export default function ReportCurrentState({ kind, view }: ReportCurrentStateProps) {
  // 알림 구역(aria-live)은 읽는 동안에도 붙여 둔다 — 다 읽은 뒤 내용째 새로 붙으면 화면 읽기 프로그램이 읽어 주지 않는다(코덱스 10R)
  return (
    <div aria-live="polite" className="text-xs">
      <ReportCurrentStateBody kind={kind} view={view} />
    </div>
  );
}

/**
 * 알림 구역 안의 내용 — 읽는 중 · 못 읽음 · 신고에 남을 값.
 * @param props.kind - 고른 종류
 * @param props.view - 상태
 */
function ReportCurrentStateBody({ kind, view }: ReportCurrentStateProps) {
  if (view.loading) return <p className="text-gray-400">신고에 남을 태그·출처를 불러오는 중…</p>;
  if (view.failed || !view.state) {
    return (
      <p className="flex flex-wrap items-center gap-2 text-gray-500">
        신고에 남을 태그·출처를 불러오지 못했어요. 신고는 할 수 있어요.
        <Button type="button" variant="outline" size="sm" onClick={view.reload}>다시 불러오기</Button>
      </p>
    );
  }
  const { tags, source, number } = view.state;
  const input = reportSourceInput(source);
  const label = input ? sourceLabelWithNumber(input, number) : '';
  const tagBlock = (
    <div key="tag">
      <p className="font-semibold">지금 붙은 태그</p>
      {tags === null ? (
        <p className="text-gray-500">원본 문항이 지워져 지금 붙은 태그가 없어요. 무엇이 틀렸는지 내용에 적어 주세요.</p>
      ) : (
        <ReportTagGroupsView tags={tags} />
      )}
    </div>
  );
  const sourceBlock = (
    <div key="source">
      <p className="font-semibold">신고될 출처</p>
      {label && <p>{label}</p>}
      {/* 서버는 출처의 모든 칸을 대조한다 — 줄에 안 드러나는 칸(유형·학년·제목 …)도 칸마다(7·8R) */}
      <div className="text-[11px]"><ReportSourceFieldsView source={source} number={number} /></div>
    </div>
  );
  return (
    <div className="space-y-1.5 rounded-md bg-gray-50 px-3 py-2 break-keep [overflow-wrap:anywhere] text-gray-700">
      {kind === 'tag' ? [tagBlock, sourceBlock] : [sourceBlock, tagBlock]}
    </div>
  );
}
