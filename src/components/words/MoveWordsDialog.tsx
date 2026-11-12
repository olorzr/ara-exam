'use client';

import { useMemo, useState } from 'react';
import type { Category } from '@/types';
import { CategoryTree } from '@/components/words';
import { buildCategoryTree } from '@/lib/category-tree';
import { formatCategoryLabel } from '@/lib/format';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface MoveWordsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  excludeCategoryId: string;
  selectedCount: number;
  onConfirm: (targetCategory: Category) => void;
}

/**
 * 선택한 단어들을 다른 소단원(카테고리)으로 이동하기 위한 다이얼로그.
 * 현재 카테고리를 제외한 카테고리 트리를 표시한다.
 */
export default function MoveWordsDialog({
  open, onOpenChange, categories, excludeCategoryId, selectedCount, onConfirm,
}: MoveWordsDialogProps) {
  const [targetCategory, setTargetCategory] = useState<Category | null>(null);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const excluded = categories.filter((c) => c.id !== excludeCategoryId);
    if (!search) return excluded;
    const q = search.toLowerCase();
    return excluded.filter((c) => {
      const label = formatCategoryLabel(c).toLowerCase();
      return label.includes(q) || c.level.includes(q);
    });
  }, [categories, excludeCategoryId, search]);

  const tree = useMemo(() => buildCategoryTree(filtered), [filtered]);

  const handleConfirm = () => {
    if (!targetCategory) return;
    onConfirm(targetCategory);
    setTargetCategory(null);
    setSearch('');
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setTargetCategory(null);
      setSearch('');
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>단어 이동 ({selectedCount}개 선택)</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-gray-500">이동할 카테고리를 선택하세요.</p>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="카테고리 검색..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="max-h-64 overflow-y-auto border rounded-md p-2">
          <CategoryTree
            nodes={tree}
            selectedId={targetCategory?.id}
            onSelect={setTargetCategory}
          />
        </div>

        {targetCategory && (
          <p className="text-sm text-primary font-medium">
            → {formatCategoryLabel(targetCategory)}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>취소</Button>
          <Button
            disabled={!targetCategory}
            onClick={handleConfirm}
          >
            이동
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
