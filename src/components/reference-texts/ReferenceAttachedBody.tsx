'use client';

import Link from 'next/link';
import { unitLabel } from '@/lib/reference-texts/units';
import type { ReferenceAttachSlot } from '@/lib/reference-texts/bundle';
import type { ReferenceText } from '@/types/reference-text';
import ReferenceBodyView from './ReferenceBodyView';

interface ReferenceAttachedBodyProps {
  row: ReferenceText;
  slot: ReferenceAttachSlot;
  /** 한 화면에 같은 자리의 글이 여럿이면(작품이 두 단원에 실렸다) 어느 단원 것인지 이름표에 붙인다 */
  showUnit?: boolean;
  /** 원장만 넘긴다 — 붙은 글의 보기 화면(거기서 편집)으로 가는 길 */
  editHref?: string;
}

/**
 * 다른 글에 붙어 보이는 글 하나(sql/102) — 작품 맨 위의 제재 정리, 단원 총괄 오른쪽 칸의 여백 글.
 *
 * 본문은 `ReferenceBodyView` 그대로라 정화 · 말머리 상자 · 표가 보기 화면과 한 벌이다. 여백 칸은 글자가 작다(`ref-sheet--wing`).
 * 고치기는 붙은 글 자신의 화면에서 한다 — 붙여 보이는 쪽 편집기에 섞으면 저장할 때 두 글의 경계가 사라진다.
 * @param props - 붙은 글 · 자리 · 단원 표시 · 고치기 경로
 * @returns 붙은 글 구역
 */
export default function ReferenceAttachedBody({ row, slot, showUnit, editHref }: ReferenceAttachedBodyProps) {
  const label = slot === 'top' ? '제재 정리' : '함께 보기';
  const unit = showUnit && row.units[0] ? unitLabel(row.units[0]) : '';
  return (
    <section className={`ref-attached ref-attached--${slot}`} aria-label={unit ? `${label} · ${unit}` : label}>
      {(slot === 'top' || editHref) && (
        <div className="ref-attached__head">
          {slot === 'top' && <span className="ref-attached__label">{label}{unit && <span className="ref-attached__unit"> · {unit}</span>}</span>}
          {editHref && (
            <Link href={editHref} className="ref-attached__edit" data-no-print>고치기</Link>
          )}
        </div>
      )}
      <ReferenceBodyView body={row.body} format={row.format} kind={row.kind} className={slot === 'wing' ? 'ref-sheet--wing' : 'ref-sheet--top'} />
    </section>
  );
}
