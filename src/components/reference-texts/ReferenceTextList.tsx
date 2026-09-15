'use client';

import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import type { ReferenceTextListItem } from '@/types/reference-text';

/**
 * 작품 전문 목록.
 *
 * 줄 전체를 `<Link>` 로 감싸지 않는다 — 그 안에 버튼을 넣으면 잘못된 HTML 이고 키보드로도
 * 못 쓴다(문제지 목록과 같은 모양).
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
          <Link href={`/reference-texts/${row.id}`} className="min-w-0 flex-1 hover:underline">
            <span className="block truncate text-sm font-medium text-gray-900">{row.title}</span>
            <span className="mt-0.5 block truncate text-xs text-gray-400">
              {[row.author, `${row.char_count.toLocaleString()}자`, row.updated_at.slice(0, 10)]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </Link>
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
