'use client';

import { Fragment } from 'react';
import { reportSourceFields, reportTagGroups, reportVisibleSegments, type ReportTags } from '@/lib/problem-report/display';

/**
 * 안 보이거나 공백처럼 보이는 글자를 ⟨U+XXXX⟩ 로 드러내 그린 글(Stop 게이트 — 지문이 다르면 화면도 다르게). 방향 제어 글자가 실제 글자로
 * 남지 않아 뒤의 글(예: '17번')이 뒤집혀 보이지 않는다(코덱스 11R). 신고 창의 머리 줄·요약 줄·값 칸이 쓴다.
 * @param props.value - 글(정규화한 글)
 */
export function VisibleText({ value }: { value: string }) {
  return (
    <>
      {reportVisibleSegments(value).map((seg, i) => (seg.hidden ? (
        <span key={i} title="화면에 안 보이는 글자" className="mx-px rounded bg-amber-100 px-0.5 text-[10px] text-amber-900">⟨{seg.text}⟩</span>
      ) : (
        <Fragment key={i}>{seg.text}</Fragment>
      )))}
    </>
  );
}

/**
 * 값 한 칸 — 테두리로 경계를 보이고 글은 `VisibleText` 로 그린다.
 * @param props.value - 값(정규화한 글)
 */
function ValueCell({ value }: { value: string }) {
  return (
    <span className="mx-0.5 my-0.5 inline-block rounded border border-gray-300 bg-white px-1 leading-snug break-keep [overflow-wrap:anywhere]">
      <VisibleText value={value} />
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
              <ValueCell value={value} />
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
          <ValueCell value={f.value} />
        </span>
      ))}
      {fields === null && <span className="text-gray-500">(출처 없음)</span>}
    </p>
  );
}
