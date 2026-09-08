'use client';

import { ChevronDown, ChevronUp, GripVertical, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { areaPathLabel } from '@/lib/problem-bank/area-tree';
import type { ArchiveRow } from '@/hooks/useProblemArchive';

/** 카드에서 보여 줄 발문 길이 */
const EXCERPT_LENGTH = 70;

function excerpt(html: string): string {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH)}…` : text;
}

interface CanvasItemProps {
  row: ArchiveRow | undefined;
  /** 인쇄에 찍힐 번호 (1부터) */
  number: number;
  /** 같은 지문 묶음의 첫 문항인가 — 지문 표시를 여기에만 붙인다 */
  groupStart: boolean;
  dragHandlers: React.HTMLAttributes<HTMLElement>;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

/**
 * 캔버스에 놓인 문항 한 줄.
 *
 * 드래그가 기본이지만 위·아래 버튼도 함께 둔다 — 키보드만 쓰는 사람과
 * 터치 화면에서도 순서를 바꿀 수 있어야 한다.
 */
export default function CanvasItem({
  row, number, groupStart, dragHandlers, onRemove, onMoveUp, onMoveDown,
}: CanvasItemProps) {
  return (
    <div
      data-drag-item
      className="flex items-start gap-2 rounded border border-gray-200 bg-white p-2"
    >
      <button
        type="button"
        {...dragHandlers}
        className="mt-0.5 shrink-0 cursor-grab touch-none rounded p-1 text-gray-400 hover:bg-gray-100 active:cursor-grabbing"
        aria-label={`${number}번 문항 끌어서 옮기기`}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <span className="mt-0.5 w-6 shrink-0 text-sm font-semibold text-gray-700">{number}</span>

      <div className="min-w-0 flex-1">
        {groupStart && row?.passage_id && (
          <Badge variant="outline" className="mb-1">지문 묶음 시작</Badge>
        )}
        <p className="text-sm text-gray-800">
          {row ? excerpt(row.stem_html) : '(불러오지 못한 문항)'}
        </p>
        {row && (
          <p className="mt-0.5 text-xs text-gray-500">
            {row.source.school_name || row.source.publisher} {row.source.year}
            {row.work_title && ` · ${row.work_title}`}
            {row.area_path.length > 0 && ` · ${areaPathLabel(row.area_path)}`}
            {!row.answer && ' · 정답 없음'}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center">
        <button
          type="button" onClick={onMoveUp}
          className="rounded p-1 text-gray-400 hover:bg-gray-100"
          aria-label={`${number}번 위로`}
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          type="button" onClick={onMoveDown}
          className="rounded p-1 text-gray-400 hover:bg-gray-100"
          aria-label={`${number}번 아래로`}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
        <button
          type="button" onClick={onRemove}
          className="rounded p-1 text-gray-400 hover:bg-gray-100"
          aria-label={`${number}번 빼기`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
