'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { CategoryTree } from '@/components/words';
import { ConceptSheetCard } from '@/components/exam-builder';
import { PlusCircle, Search, FileText, List } from 'lucide-react';
import { useConceptList } from '@/hooks/useConceptList';

/**
 * 개념지 목록 페이지.
 * 좌측에 카테고리 트리, 우측에 개념지 카드 목록을 표시한다.
 * 상태·조회·필터·삭제·페이지네이션은 useConceptList 훅이 담당한다.
 */
export default function ConceptListPage() {
  const {
    sheets,
    loading,
    searchQuery,
    selectedCategory,
    tree,
    filtered,
    visible,
    hasMore,
    selectCategory,
    changeSearch,
    clearCategory,
    showMore,
    deleteSheet,
  } = useConceptList();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">📝 개념 관리</h1>
        <Link href="/exam/builder/new">
          <Button className="bg-primary hover:bg-primary-hover text-white">
            <PlusCircle className="h-4 w-4 mr-2" />
            새 개념지 만들기
          </Button>
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="제목, 출판사, 단원 검색..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => changeSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 카테고리 트리 */}
        <div className="space-y-4">
          <Card>
            <CardContent className="py-4">
              {selectedCategory && (
                <button
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary px-2 mb-3"
                  onClick={clearCategory}
                >
                  <List className="h-3.5 w-3.5" />
                  전체 보기
                </button>
              )}
              {tree.length > 0 ? (
                <CategoryTree
                  nodes={tree}
                  selectedId={selectedCategory?.id}
                  onSelect={selectCategory}
                />
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">
                  아직 만든 개념지가 없습니다.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 개념지 목록 */}
        <div className="lg:col-span-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-300">
              <FileText className="h-12 w-12 mb-3" />
              <p className="text-sm">
                {sheets.length === 0
                  ? '아직 만든 개념지가 없습니다.'
                  : selectedCategory
                    ? '이 카테고리에 해당하는 개념지가 없습니다.'
                    : '검색 결과가 없습니다.'}
              </p>
              {sheets.length === 0 && (
                <Link href="/exam/builder/new" className="mt-4">
                  <Button variant="outline" size="sm">
                    첫 개념지 만들기
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{filtered.length}개</Badge>
                {selectedCategory && (
                  <span className="text-sm text-gray-500">
                    {[selectedCategory.grade, selectedCategory.publisher, selectedCategory.semester, selectedCategory.chapter, selectedCategory.sub_chapter].filter(Boolean).join(' ')}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {visible.map((sheet) => (
                  <ConceptSheetCard
                    key={sheet.id}
                    sheet={sheet}
                    onDelete={deleteSheet}
                  />
                ))}
              </div>
              {hasMore && (
                <div className="flex justify-center pt-2">
                  <Button variant="outline" onClick={showMore}>
                    더 보기 ({filtered.length - visible.length}개 남음)
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
