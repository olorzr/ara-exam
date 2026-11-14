'use client';

import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { ItemNo, PaperList } from '@/components/magazine';
import { Badge } from '@/components/ui/badge';
import { unitKey, unitLabel } from '@/lib/reference-texts/units';
import type { ReferenceTextListItem } from '@/types/reference-text';

/** 줄마다 보여 줄 단원 수 — 나머지는 '외 n' 으로 접는다(줄이 넘쳐 목록이 들쭉날쭉해진다) */
const UNITS_SHOWN = 2;

/** 한 줄에 보여 줄 태그 수 */
const TAGS_SHOWN = 3;

/**
 * 작품 전문 · 개념 목록.
 *
 * 줄 전체를 `<Link>` 로 감싸지 않는다 — 그 안에 버튼을 넣으면 잘못된 HTML 이고 키보드로도
 * 못 쓴다(문제지 목록과 같은 모양).
 *
 * 같은 작품의 판본이 나란히 나올 때 가를 수 있게 **판본 메모**와 **붙은 단원**을 함께 보여 준다.
 * 종류(작품 / 개념)는 글자 배지로 알린다 — 색만으로 가르지 않는다.
 */

interface ReferenceTextListProps {
  rows: ReferenceTextListItem[];
  /** 지우는 중인 줄 */
  busyId: string | null;
  /** 원장만 넘긴다 — 없으면 지우기 단추를 그리지 않는다(sql/84: 지우기는 원장만, 눌리는데 조용한 단추를 두지 않는다) */
  onDelete?: (row: ReferenceTextListItem) => void;
}

/**
 * 목록을 그린다.
 * @param props - 줄과 삭제 콜백
 * @returns 목록
 */
export default function ReferenceTextList({ rows, busyId, onDelete }: ReferenceTextListProps) {
  // 종이 목록 한 장 + 공용 꼬리표(2026-11-14 — 예전엔 회색·남색 네모 칩이 섞였다)
  return (
    <PaperList as="ul">
      {rows.map((row, index) => (
        <li key={row.id} className="flex items-start gap-2 px-4 py-3">
          <ItemNo n={index + 1} />
          <div className="min-w-0 flex-1">
            <Link href={`/reference-texts/${row.id}`} className="group block">
              <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <Badge variant={row.kind === '개념' ? 'secondary' : 'outline'}>{row.kind}</Badge>
                {row.seq !== null && <span className="font-label text-xs text-gray-400">#{row.seq}</span>}
                <span className="text-[15px] leading-snug font-semibold break-keep text-ink group-hover:text-primary">{row.title}</span>
                {row.note && <span className="text-xs text-amber-700">{row.note}</span>}
              </span>
              <span className="mt-0.5 block truncate text-xs text-gray-500">
                {[
                  row.author,
                  `${row.char_count.toLocaleString()}자`,
                  row.grammar_paths.length > 0 ? `문법 ${row.grammar_paths.length}` : '',
                  row.updated_at.slice(0, 10),
                ].filter(Boolean).join(' · ')}
              </span>
            </Link>
            {(row.units.length > 0 || row.tags.length > 0) && (
              <ul className="mt-1.5 flex flex-wrap gap-1" aria-label="실린 교과서 단원과 태그">
                {row.units.slice(0, UNITS_SHOWN).map((unit) => (
                  <li key={unitKey(unit)} className="max-w-full"><Badge variant="muted" className="max-w-full"><span className="min-w-0 truncate">{unitLabel(unit)}</span></Badge></li>
                ))}
                {row.units.length > UNITS_SHOWN && (
                  <li className="px-1 text-[11px] text-gray-400">외 {row.units.length - UNITS_SHOWN}</li>
                )}
                {row.tags.slice(0, TAGS_SHOWN).map((tag) => (
                  <li key={`tag:${tag}`}><Badge variant="ok">#{tag}</Badge></li>
                ))}
              </ul>
            )}
          </div>
          {onDelete && (
            <button
              type="button"
              disabled={busyId !== null}
              onClick={() => onDelete(row)}
              aria-label={`${row.title} 지우기`}
              className="h-8 w-8 shrink-0 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
            >
              <Trash2 className="mx-auto h-4 w-4" />
            </button>
          )}
        </li>
      ))}
    </PaperList>
  );
}
