'use client';

import { CheckSquare, Tag, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ArchiveSelectionBarProps {
  selectMode: boolean;
  /** 지금 보이는 행 중 선택된 개수 */
  count: number;
  isAllSelected: boolean;
  /**
   * 목록이 비었거나 불러오는 중.
   * ⚠️ 선택 모드 안의 '전체 선택'·'삭제' 도 함께 막아야 한다 — 불러오는 중에는
   *    화면에 행이 없는데 버튼만 살아 있으면 안 보이는 것을 고르고 지우게 된다.
   */
  disabled?: boolean;
  /** 삭제가 진행 중 */
  busy?: boolean;
  onEnter: () => void;
  onExit: () => void;
  onToggleAll: () => void;
  onDelete: () => void;
  /** 고른 문항에 문법 분류를 붙인다 */
  onTagGrammar: () => void;
}

/**
 * 아카이브 선택 삭제 줄.
 *
 * 시험지 목록(`/exam/history`)의 선택 모드와 같은 모양이다 — 선생님이 이미 아는 조작이라
 * 새 규칙을 만들지 않는다.
 */
export default function ArchiveSelectionBar({
  selectMode, count, isAllSelected, disabled, busy,
  onEnter, onExit, onToggleAll, onDelete, onTagGrammar,
}: ArchiveSelectionBarProps) {
  if (!selectMode) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={onEnter} disabled={disabled}>
        <CheckSquare className="h-4 w-4" />
        <span className="ml-1">선택</span>
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={onExit} disabled={busy}>
        <X className="h-4 w-4" />
        <span className="ml-1">선택 취소</span>
      </Button>
      <div className="flex flex-1 items-center gap-2 rounded-lg bg-gray-50 px-4 py-2">
        <Button
          type="button" variant="ghost" size="sm" className="text-xs"
          onClick={onToggleAll} disabled={disabled || busy}
        >
          {isAllSelected ? '전체 해제' : '전체 선택'}
        </Button>
        <span className="text-sm text-gray-500">{count}개 선택됨</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onTagGrammar}
          disabled={count === 0 || busy || disabled}
          className="ml-auto text-xs"
        >
          <Tag className="h-3.5 w-3.5" />
          <span className="ml-1">문법 분류</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onDelete}
          disabled={count === 0 || busy || disabled}
          className="text-xs text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="ml-1">{busy ? '지우는 중…' : `${count}개 삭제`}</span>
        </Button>
      </div>
    </div>
  );
}
