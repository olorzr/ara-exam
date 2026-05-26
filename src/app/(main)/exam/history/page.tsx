'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileText, Trash2, Search, CheckSquare, X } from 'lucide-react';
import { ExamHistoryCard, ExamHistoryFilter } from '@/components/exam';
import { useExamHistory } from '@/hooks/useExamHistory';

/**
 * 시험 이력 페이지. 원본 시험 아래에 재시험이 스레드로 표시된다.
 * 상태·필터·재시험 생성 로직은 useExamHistory 훅이 담당한다.
 */
export default function ExamHistoryPage() {
  const h = useExamHistory();

  if (h.loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p className="text-sm text-gray-400">불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">시험 이력</h1>
        <Link href="/exam/create">
          <Button className="bg-primary hover:bg-primary-hover text-white">
            <FileText className="h-4 w-4 mr-2" />
            새 시험지
          </Button>
        </Link>
      </div>

      {/* 필터 영역 */}
      {h.originalExams.length > 0 && (
        <>
          <ExamHistoryFilter
            searchQuery={h.searchQuery}
            onSearchChange={h.onSearchChange}
            dateFrom={h.dateFrom}
            dateTo={h.dateTo}
            onDateFromChange={h.onDateFromChange}
            onDateToChange={h.onDateToChange}
            filterCategoryIds={h.filterCategoryIds}
            onCategoryToggle={h.handleCategoryToggle}
            onClearFilters={h.clearFilters}
            categoryTree={h.categoryTree}
            hasActiveFilters={h.hasActiveFilters}
          />

          {/* 선택 모드 토글 */}
          <div className="flex items-center gap-2">
            {!h.selectMode ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => h.setSelectMode(true)}
                disabled={h.filteredExams.length === 0}
              >
                <CheckSquare className="h-4 w-4 mr-1" />
                선택
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={h.exitSelectMode}>
                  <X className="h-4 w-4 mr-1" />
                  선택 취소
                </Button>
                <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-4 py-2">
                  <Button variant="ghost" size="sm" onClick={h.toggleSelectAll} className="text-xs">
                    {h.isAllSelected ? '전체 해제' : '전체 선택'}
                  </Button>
                  <span className="text-sm text-gray-500">
                    {h.selectedIds.size}개 선택됨
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={h.handleBulkDelete}
                    disabled={h.selectedIds.size === 0}
                    className="text-xs text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600 ml-auto"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    {h.selectedIds.size}개 삭제
                  </Button>
                </div>
              </>
            )}
            {h.hasActiveFilters && (
              <span className="text-xs text-gray-400 ml-2">
                {h.filteredExams.length}개의 결과
              </span>
            )}
          </div>
        </>
      )}

      {h.filteredExams.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {h.filteredExams.map((exam) => (
            <ExamHistoryCard
              key={exam.id}
              exam={exam}
              retakes={h.retakeMap.get(exam.id)}
              onDelete={h.handleDelete}
              onRetest={h.handleRetest}
              retesting={h.retestingId === exam.id}
              selectMode={h.selectMode}
              selected={h.selectedIds.has(exam.id)}
              onToggleSelect={h.toggleSelect}
            />
          ))}
        </div>
      ) : h.originalExams.length > 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Search className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-400">검색 결과가 없어요</p>
          <p className="text-xs text-gray-400 mt-1">다른 조건으로 검색해보세요!</p>
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">-</div>
          <p className="text-sm text-gray-500 font-medium">아직 시험지가 없어요!</p>
          <p className="text-xs text-gray-400 mt-1">첫 시험지를 만들어볼까요?</p>
          <Link href="/exam/create">
            <Button variant="outline" className="mt-4">
              시험지 만들기
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
