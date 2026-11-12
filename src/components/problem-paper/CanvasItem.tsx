'use client';

import { ChevronDown, ChevronUp, ChevronsDown, ChevronsUp, GripVertical, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { areaPathLabel } from '@/lib/problem-bank/area-tree';
import { excerptHtml } from '@/lib/html-excerpt';
import type { CanvasItemDisplay } from '@/lib/problem-paper/canvas-display';

/** 카드에서 보여 줄 발문 길이 */
const EXCERPT_LENGTH = 70;

interface CanvasItemProps {
  /** 그릴 것 — 원본을 아직 못 받았으면 undefined */
  display: CanvasItemDisplay | undefined;
  /** 인쇄에 찍힐 번호 (1부터) */
  number: number;
  /** 같은 지문 묶음의 첫 문항인가 — 지문 표시를 여기에만 붙인다 */
  groupStart: boolean;
  /** 지문에 딸린 문항인가(캔버스 항목의 지문 id 로 정한다 — 기존 항목은 스냅샷의 지문) */
  inPassage: boolean;
  dragHandlers: React.HTMLAttributes<HTMLElement>;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  /**
   * 지문 묶음 통째로 옮기기 — 묶음의 첫 문항에만 준다.
   *
   * 문항 하나씩 옮기는 버튼은 **자기 묶음 안에서만** 움직인다(같은 지문이 흩어지면
   * 안 되므로). 그래서 묶음을 다른 지문 앞뒤로 보내려면 별도 조작이 필요하다.
   */
  onMoveGroupUp?: () => void;
  onMoveGroupDown?: () => void;
  /** 고치기 — 이 저장된 지문 묶음을 지금 문제 은행의 지문·문항으로 다시 담는다(묶음의 첫 문항에만, 다시 굳힐 수 있을 때만) */
  onRefreshGroup?: () => void;
}

/** 고치기 화면의 갈래 표시 — 새로 담은 문항 · 원본이 지워진 저장 항목 */
function OriginBadge({ display }: { display: CanvasItemDisplay }) {
  if (display.orphan) return <Badge variant="outline" className="ml-1 align-middle text-[10px]">원본 삭제됨</Badge>;
  if (display.origin === 'new') return <Badge variant="secondary" className="ml-1 align-middle text-[10px]">새로 담음</Badge>;
  if (display.origin === 'refresh') return <Badge variant="secondary" className="ml-1 align-middle text-[10px]">최신으로 바꿈</Badge>;
  return null;
}

/**
 * 캔버스에 놓인 문항 한 줄.
 *
 * 드래그가 기본이지만 위·아래 버튼도 함께 둔다 — 키보드만 쓰는 사람과
 * 터치 화면에서도 순서를 바꿀 수 있어야 한다.
 */
export default function CanvasItem({
  display, number, groupStart, inPassage, dragHandlers, onRemove, onMoveUp, onMoveDown,
  onMoveGroupUp, onMoveGroupDown, onRefreshGroup,
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
        {groupStart && inPassage && (
          <div className="mb-1 flex items-center gap-1">
            <Badge variant="outline">지문 묶음</Badge>
            {onMoveGroupUp && (
              <button
                type="button" onClick={onMoveGroupUp}
                className="rounded p-0.5 text-gray-400 hover:bg-gray-100"
                aria-label="이 지문 묶음을 앞으로"
              >
                <ChevronsUp className="h-3.5 w-3.5" />
              </button>
            )}
            {onMoveGroupDown && (
              <button
                type="button" onClick={onMoveGroupDown}
                className="rounded p-0.5 text-gray-400 hover:bg-gray-100"
                aria-label="이 지문 묶음을 뒤로"
              >
                <ChevronsDown className="h-3.5 w-3.5" />
              </button>
            )}
            {onRefreshGroup && (
              <button
                type="button" onClick={onRefreshGroup}
                className="ml-auto rounded px-1.5 py-0.5 text-[11px] text-gray-500 underline-offset-2 hover:bg-gray-100 hover:underline"
                title="이 묶음을 지금 문제 은행의 지문·문항으로 다시 담아요(저장할 때 바뀌어요)"
              >
                최신 지문으로
              </button>
            )}
          </div>
        )}
        <p className="text-sm text-gray-800">
          {display ? excerptHtml(display.stemHtml, EXCERPT_LENGTH) : '(불러오지 못한 문항)'}
          {display && <OriginBadge display={display} />}
        </p>
        {display && (
          <p className="mt-0.5 text-xs text-gray-500">
            {display.sourceLabel}
            {display.workTitle && ` · ${display.workTitle}`}
            {display.areaPath.length > 0 && ` · ${areaPathLabel(display.areaPath)}`}
            {!display.hasAnswer && ' · 정답 없음'}
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
