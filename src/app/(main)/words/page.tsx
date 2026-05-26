'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  WordCardGrid,
  CategoryTree,
  MoveWordsDialog,
  WordListHeader,
  WordEditDialog,
} from '@/components/words';
import { PlusCircle, Search, Settings } from 'lucide-react';
import { useWordsManager } from '@/hooks/useWordsManager';

/**
 * 단어 관리 페이지. 트리 구조로 카테고리 탐색, 단어 조회/수정/삭제 기능을 제공한다.
 * 상태·데이터·핸들러는 useWordsManager 훅이 담당하고, 이 컴포넌트는 화면 구성만 한다.
 */
export default function WordsPage() {
  const m = useWordsManager();

  if (m.loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">📚 단어 관리</h1>
        <div className="flex items-center gap-2">
          <Link href="/words/categories">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-1" />
              카테고리 관리
            </Button>
          </Link>
          <Link href="/words/new">
            <Button className="bg-primary hover:bg-primary-hover text-white">
              <PlusCircle className="h-4 w-4 mr-2" />
              단어 추가
            </Button>
          </Link>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="카테고리 검색..."
          className="pl-10"
          value={m.searchQuery}
          onChange={(e) => m.setSearchQuery(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 카테고리 트리 */}
        <div className="space-y-4">
          <Card>
            <CardContent className="py-4">
              <CategoryTree
                nodes={m.tree}
                selectedId={m.selectedCategory?.id}
                onSelect={m.handleSelectCategory}
              />
            </CardContent>
          </Card>
        </div>

        {/* 단어 목록 */}
        <div className="lg:col-span-2">
          {m.selectedCategory ? (
            <div className="space-y-4">
              <WordListHeader
                category={m.selectedCategory}
                wordCount={m.words.length}
                sortOrder={m.sortOrder}
                onSortChange={m.setSortOrder}
                selectMode={m.selectMode}
                selectedCount={m.selectedWordIds.size}
                onEnterSelectMode={() => m.setSelectMode(true)}
                onExitSelectMode={m.exitSelectMode}
                onDeleteCategory={m.handleDeleteCategory}
                onToggleSelectAll={m.toggleSelectAll}
                onOpenMove={() => m.setMoveDialogOpen(true)}
                onBulkDelete={m.handleBulkDelete}
              />

              <WordCardGrid
                words={m.sortedWords}
                onEdit={m.startEdit}
                onDelete={m.handleDeleteWord}
                selectMode={m.selectMode}
                selectedIds={m.selectedWordIds}
                onToggleSelect={m.toggleWordSelect}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-gray-300">
              <Search className="h-12 w-12 mb-3" />
              <p className="text-sm">카테고리를 선택해주세요</p>
            </div>
          )}
        </div>
      </div>

      <WordEditDialog
        open={!!m.editWord}
        form={m.editForm}
        onFormChange={m.setEditForm}
        onClose={() => m.setEditWord(null)}
        onSave={m.handleEditSave}
      />

      {m.selectedCategory && (
        <MoveWordsDialog
          open={m.moveDialogOpen}
          onOpenChange={m.setMoveDialogOpen}
          categories={m.categories}
          excludeCategoryId={m.selectedCategory.id}
          selectedCount={m.selectedWordIds.size}
          onConfirm={m.handleMoveConfirm}
        />
      )}
    </div>
  );
}
