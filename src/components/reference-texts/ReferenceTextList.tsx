'use client';

import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { unitKey, unitLabel } from '@/lib/reference-texts/units';
import type { ReferenceTextListItem } from '@/types/reference-text';

/** 줄마다 보여 줄 단원 수 — 나머지는 '외 n' 으로 접는다(줄이 넘쳐 목록이 들쭉날쭉해진다) */
const UNITS_SHOWN = 2;

/**
 * 작품 전문 목록.
 *
 * 줄 전체를 `<Link>` 로 감싸지 않는다 — 그 안에 버튼을 넣으면 잘못된 HTML 이고 키보드로도
 * 못 쓴다(문제지 목록과 같은 모양).
 *
 * 같은 작품의 판본이 나란히 나올 때 가를 수 있게 **판본 메모**와 **붙은 단원**을 함께 보여 준다.
 */

interface ReferenceTextListProps {
  rows: ReferenceTextListItem[];
  /** 지우는 중인 줄 */
  busyId: string | null;
  onDelete: (row: ReferenceTextListItem) => void;
}

/**
 * 목록을 그린다.
 * @param props - 줄과 삭제 콜백
 * @returns 목록
 */
export default function ReferenceTextList({ rows, busyId, onDelete }: ReferenceTextListProps) {
  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
      {rows.map((row) => (
        <li key={row.id} className="flex items-center gap-2 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <Link href={`/reference-texts/${row.id}`} className="block hover:underline">
              <span className="block truncate text-sm font-medium text-gray-900">
                {row.title}
                {row.note && <span className="ml-2 text-xs font-normal text-amber-700">{row.note}</span>}
              </span>
              <span className="mt-0.5 block truncate text-xs text-gray-400">
                {[
                  row.author,
                  `${row.char_count.toLocaleString()}자`,
                  row.grammar_paths.length > 0 ? `문법 ${row.grammar_paths.length}` : '',
                  row.updated_at.slice(0, 10),
                ].filter(Boolean).join(' · ')}
              </span>
            </Link>
            {row.units.length > 0 && (
              <ul className="mt-1 flex flex-wrap gap-1" aria-label="실린 교과서 단원">
                {row.units.slice(0, UNITS_SHOWN).map((unit) => (
                  <li key={unitKey(unit)} className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">
                    {unitLabel(unit)}
                  </li>
                ))}
                {row.units.length > UNITS_SHOWN && (
                  <li className="px-1 py-0.5 text-[11px] text-gray-400">외 {row.units.length - UNITS_SHOWN}</li>
                )}
              </ul>
            )}
          </div>
          <button
            type="button"
            disabled={busyId !== null}
            onClick={() => onDelete(row)}
            aria-label={`${row.title} 지우기`}
            className="h-8 w-8 shrink-0 rounded text-gray-400 hover:bg-gray-100 hover:text-red-600 disabled:opacity-50"
          >
            <Trash2 className="mx-auto h-4 w-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}
