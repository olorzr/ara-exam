'use client';

import { Fragment, type ReactNode } from 'react';
import { reportSourceFields, reportTagGroups, type ReportTags } from '@/lib/problem-report/display';

/**
 * 값 한 칸 — 테두리로 경계를 보인다. 글로 이으면 서로 다른 값 묶음이 같은 글로 보인다(Stop 게이트).
 * @param props.children - 값
 */
function ValueCell({ children }: { children: ReactNode }) {
  return (
    <span className="mx-0.5 my-0.5 inline-block rounded border border-gray-300 bg-white px-1 leading-snug break-keep [overflow-wrap:anywhere]">
      {children}
    </span>
  );
}

/**
 * 태그 갈래들 — 작품·단원·영역·문법, 값마다 칸 하나(경로는 마디마다 칸 + ›). 신고 창과 신고 목록이 같이 쓴다.
 * @param props.tags - 태그
 */
export function ReportTagGroupsView({ tags }: { tags: ReportTags }) {
  const groups = reportTagGroups(tags);
  if (groups.length === 0) return <p className="text-gray-500">붙은 태그가 없어요.</p>;
  return (
    <>
      {groups.map((g) => (
        <p key={g.label}>
          <span className="mr-1 text-gray-500">{g.label}</span>
          {g.values.map((value, i) => (
            <Fragment key={i}>
              {g.path && i > 0 && <span aria-hidden="true" className="text-gray-400">›</span>}
              <ValueCell>{value}</ValueCell>
            </Fragment>
          ))}
        </p>
      ))}
    </>
  );
}

/**
 * 출처의 모든 칸 + 원래 번호 — 이름표와 값 칸. 신고 창과 출처 신고의 목록 줄이 같이 쓴다.
 * '출처 없음'(객체가 아님)과 '칸이 모두 빔' 을 다른 글로 보인다.
 * @param props.source - 출처(jsonb)
 * @param props.number - 원래 번호(없으면 null)
 */
export function ReportSourceFieldsView({ source, number }: { source: unknown; number: number | null }) {
  const fields = reportSourceFields(source);
  const cells = [...(fields ?? []), ...(number !== null ? [{ label: '원래 번호', value: `${number}` }] : [])];
  if (cells.length === 0) {
    return <p className="text-gray-500">{fields === null ? '출처가 없어요.' : '출처 칸이 모두 비어 있어요.'}</p>;
  }
  return (
    <p>
      {cells.map((f) => (
        <span key={f.label} className="mr-1 inline-block">
          <span className="text-gray-500">{f.label}</span>
          <ValueCell>{f.value}</ValueCell>
        </span>
      ))}
      {fields === null && <span className="text-gray-500">(출처 없음)</span>}
    </p>
  );
}
