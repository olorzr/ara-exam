'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckSquare, X, ArrowRightLeft, Trash2, BookOpen, ArrowUpDown } from 'lucide-react';
import { formatCategoryLabel } from '@/lib/format';
import type { Category } from '@/types';
import type { WordSortOrder } from '@/hooks/useWordsManager';

interface WordListHeaderProps {
  category: Category;
  wordCount: number;
  sortOrder: WordSortOrder;
  onSortChange: (order: WordSortOrder) => void;
  selectMode: boolean;
  selectedCount: number;
  onEnterSelectMode: () => void;
  onExitSelectMode: () => void;
  onDeleteCategory: () => void;
  onToggleSelectAll: () => void;
  onOpenMove: () => void;
  onBulkDelete: () => void;
}

/**
 * 단어 목록 상단 헤더. 카테고리명·개수·정렬, 선택/삭제/단어장 버튼과
 * 선택 모드일 때의 일괄 액션바를 렌더링한다.
 */
export default function WordListHeader({
  category,
  wordCount,
  sortOrder,
  onSortChange,
  selectMode,
  selectedCount,
  onEnterSelectMode,
  onExitSelectMode,
  onDeleteCategory,
  onToggleSelectAll,
  onOpenMove,
  onBulkDelete,
}: WordListHeaderProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-900">
            {formatCategoryLabel(category)}
          </h2>
          <Badge variant="outline">{wordCount}개</Badge>
          <Select value={sortOrder} onValueChange={(v) => { if (v) onSortChange(v as WordSortOrder); }}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <ArrowUpDown className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">오름차순 (ㄱ~ㅎ)</SelectItem>
              <SelectItem value="desc">내림차순 (ㅎ~ㄱ)</SelectItem>
              <SelectItem value="order">등록순</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {!selectMode ? (
          <div className="flex items-center gap-2">
            <Link href={`/words/print?categoryId=${category.id}`}>
              <Button variant="outline" size="sm" disabled={wordCount === 0}>
                <BookOpen className="h-4 w-4 mr-1" />
                단어장
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={onEnterSelectMode}
              disabled={wordCount === 0}
            >
              <CheckSquare className="h-4 w-4 mr-1" />
              단어 선택
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={onDeleteCategory}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              카테고리 삭제
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={onExitSelectMode}>
            <X className="h-4 w-4 mr-1" />
            선택 취소
          </Button>
        )}
      </div>

      {selectMode && (
        <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-4 py-2.5">
          <Button variant="ghost" size="sm" onClick={onToggleSelectAll}>
            {selectedCount === wordCount ? '전체 해제' : '전체 선택'}
          </Button>
          <span className="text-sm text-gray-500">{selectedCount}개 선택됨</span>
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={selectedCount === 0}
              onClick={onOpenMove}
            >
              <ArrowRightLeft className="h-4 w-4 mr-1" />
              이동
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-500 hover:text-red-600"
              disabled={selectedCount === 0}
              onClick={onBulkDelete}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              삭제
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
