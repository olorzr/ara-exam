'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { formatDateKR } from '@/lib/format';
import { buildCategoryTree } from '@/lib/category-tree';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

import { CategoryTree } from '@/components/words';
import { PlusCircle, Search, FileText, Trash2, List } from 'lucide-react';
import { toast } from 'sonner';
import type { ConceptSheetListItem, Category } from '@/types';

/** 한 번에 렌더링할 개념지 카드 수(스크롤 렌더 비용 상한) */
const PAGE_SIZE = 24;

/** 목록/트리에 필요한 컬럼만 조회한다(무거운 editor_html 제외) */
const LIST_COLUMNS =
  'id,title,level,grade,publisher,semester,unit,subunit,marks,user_id,created_at,updated_at';

/**
 * 개념지 목록 페이지.
 * 좌측에 카테고리 트리, 우측에 개념지 카드 목록을 표시한다.
 */
export default function ConceptListPage() {
  const { user } = useAuth();
  const [sheets, setSheets] = useState<ConceptSheetListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('concept_sheets')
        .select(LIST_COLUMNS)
        .order('updated_at', { ascending: false });

      if (error) {
        toast.error('개념지 목록을 불러오지 못했습니다.');
        setLoading(false);
        return;
      }
      setSheets(data ?? []);
      setLoading(false);
    })();
  }, [user]);

  /** 개념지 카테고리 필드로 합성 Category를 생성하여 트리를 구성한다 */
  const tree = useMemo(() => {
    const seen = new Map<string, Category>();
    for (const s of sheets) {
      const key = [s.level, s.grade, s.publisher, s.semester, s.unit, s.subunit].join('|');
      if (!seen.has(key)) {
        seen.set(key, {
          id: key,
          level: s.level as Category['level'],
          grade: s.grade,
          publisher: s.publisher,
          semester: s.semester,
          chapter: s.unit,
          sub_chapter: s.subunit,
          user_id: s.user_id,
          created_at: s.created_at,
        });
      }
    }
    return buildCategoryTree(Array.from(seen.values()));
  }, [sheets]);

  const handleSelectCategory = (cat: Category) => {
    setSelectedCategory((prev) => (prev?.id === cat.id ? null : cat));
    setVisibleCount(PAGE_SIZE);
  };

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    setVisibleCount(PAGE_SIZE);
  };

  const clearCategory = () => {
    setSelectedCategory(null);
    setVisibleCount(PAGE_SIZE);
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`"${title}" 개념지를 삭제하시겠습니까?`)) return;
    const { error } = await supabase.from('concept_sheets').delete().eq('id', id);
    if (error) {
      toast.error('삭제에 실패했습니다.');
      return;
    }
    setSheets((prev) => prev.filter((s) => s.id !== id));
    toast.success('개념지가 삭제되었습니다.');
  };

  const filtered = useMemo(() => {
    let result = sheets;
    if (selectedCategory) {
      result = result.filter(
        (s) =>
          s.level === selectedCategory.level &&
          s.grade === selectedCategory.grade &&
          s.publisher === selectedCategory.publisher &&
          s.semester === selectedCategory.semester &&
          s.unit === selectedCategory.chapter &&
          s.subunit === selectedCategory.sub_chapter,
      );
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.publisher.toLowerCase().includes(q) ||
          s.unit.toLowerCase().includes(q) ||
          s.grade.toLowerCase().includes(q),
      );
    }
    return result;
  }, [sheets, selectedCategory, searchQuery]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visible.length;

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
          onChange={(e) => handleSearchChange(e.target.value)}
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
                  onSelect={handleSelectCategory}
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
                    onDelete={handleDelete}
                  />
                ))}
              </div>
              {hasMore && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  >
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

/* ── 개념지 카드 ── */

interface ConceptSheetCardProps {
  sheet: ConceptSheetListItem;
  onDelete: (id: string, title: string) => void;
}

/** 개념지 카드 컴포넌트. 제목, 카테고리, 마킹 수, 수정일을 표시한다. */
function ConceptSheetCard({ sheet, onDelete }: ConceptSheetCardProps) {
  const categoryLabel = [sheet.grade, sheet.publisher, sheet.semester, sheet.unit, sheet.subunit]
    .filter(Boolean)
    .join(' ');

  const markCount = Array.isArray(sheet.marks) ? sheet.marks.length : 0;

  return (
    <Link href={`/exam/builder/${sheet.id}`}>
      <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group h-full">
        <CardContent className="p-5 flex flex-col h-full">
          {/* 상단: 레벨 뱃지 + 삭제 */}
          <div className="flex items-center justify-between mb-3">
            <Badge variant="outline" className="text-xs">
              {sheet.level}
            </Badge>
            <button
              className="w-7 h-7 flex items-center justify-center rounded text-gray-300 hover:bg-red-50 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete(sheet.id, sheet.title);
              }}
              aria-label={`${sheet.title} 삭제`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {/* 제목 */}
          <h3 className="font-bold text-gray-900 text-base mb-1 line-clamp-2">
            {sheet.title}
          </h3>

          {/* 카테고리 */}
          {categoryLabel && (
            <p className="text-xs text-gray-500 mb-3 truncate">{categoryLabel}</p>
          )}

          {/* 하단: 마킹 수 + 수정일 */}
          <div className="mt-auto flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-gray-100">
            <span>마킹 {markCount}개</span>
            <span>{formatDateKR(sheet.updated_at)}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
