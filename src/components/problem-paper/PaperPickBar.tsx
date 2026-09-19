'use client';

import { CheckSquare, FolderPlus, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaperPickBarProps {
  selectMode: boolean;
  /** 지금 보이는 행 중 선택된 개수 */
  count: number;
  isAllSelected: boolean;
  /**
   * 목록이 비었거나 불러오는 중.
   * ⚠️ 선택 모드 안의 '전체 선택'·'담기' 도 함께 막아야 한다 — 불러오는 중에는
   *    화면에 행이 없는데 버튼만 살아 있으면 안 보이는 것을 고르고 담게 된다.
   */
  disabled?: boolean;
  /** 지금 조건에 걸린 전체 문항 수 (폴더 담기 버튼에 적는다) */
  folderTotal: number;
  /** 담을 폴더가 정해졌는가 — 조건이 하나도 없으면 '전체' 라 담을 폴더가 아니다 */
  folderEnabled: boolean;
  folderBusy: boolean;
  onEnter: () => void;
  onExit: () => void;
  onToggleAll: () => void;
  onAddSelected: () => void;
  onAddFolder: () => void;
}

/**
 * 문제지 조합 화면의 **골라 담기 줄**.
 *
 * 아카이브의 선택 줄(`ArchiveSelectionBar`)과 같은 생김새다 — 선생님이 이미 아는 조작이라
 * 새 규칙을 만들지 않는다. 다른 점은 끝이 '삭제' 가 아니라 '담기' 라는 것과,
 * 선택 모드 밖에 **폴더 통째로 담기**가 함께 있다는 것이다.
 */
export default function PaperPickBar({
  selectMode, count, isAllSelected, disabled, folderTotal, folderEnabled, folderBusy,
  onEnter, onExit, onToggleAll, onAddSelected, onAddFolder,
}: PaperPickBarProps) {
  if (!selectMode) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onEnter} disabled={disabled}>
          <CheckSquare className="h-4 w-4" />
          <span className="ml-1">골라 담기</span>
        </Button>
        <Button
          type="button" variant="outline" size="sm"
          onClick={onAddFolder}
          disabled={!folderEnabled || folderBusy}
          // 조건이 없으면 '전체' 라 담을 폴더가 아니다 — 왜 못 누르는지 손끝에 남긴다
          title={folderEnabled ? undefined : '왼쪽 트리에서 폴더를 고르거나 조건을 걸어 주세요.'}
        >
          <FolderPlus className="h-4 w-4" />
          <span className="ml-1">
            {folderBusy ? '담는 중…' : `이 폴더 전체 담기${folderEnabled ? ` · ${folderTotal}문항` : ''}`}
          </span>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={onExit}>
        <X className="h-4 w-4" />
        <span className="ml-1">선택 취소</span>
      </Button>
      <div className="flex flex-1 items-center gap-2 rounded-lg bg-gray-50 px-4 py-2">
        <Button
          type="button" variant="ghost" size="sm" className="text-xs"
          onClick={onToggleAll} disabled={disabled}
        >
          {isAllSelected ? '전체 해제' : '이 쪽 전체 선택'}
        </Button>
        <span className="text-sm text-gray-500">{count}개 선택됨</span>
        <Button
          type="button" size="sm" className="ml-auto text-xs"
          onClick={onAddSelected} disabled={count === 0 || disabled}
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="ml-1">{count}개 담기</span>
        </Button>
      </div>
    </div>
  );
}
