'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { buildCategoryTree } from '@/lib/category-tree';
import { toast } from 'sonner';
import type { ConceptSheetListItem, Category } from '@/types';

/** 한 번에 렌더링할 개념지 카드 수(스크롤 렌더 비용 상한) */
const PAGE_SIZE = 24;

/** 목록/트리에 필요한 컬럼만 조회한다(무거운 editor_html 제외) */
const LIST_COLUMNS =
  'id,title,level,grade,publisher,semester,unit,subunit,marks,user_id,created_at,updated_at';

/**
 * 개념지 목록 페이지의 상태·데이터·트리·필터·삭제·렌더 페이지네이션을 캡슐화한 훅.
 * editor_html 을 제외한 경량 목록을 로드하고, 카테고리 트리/검색으로 필터링한다.
 */
export function useConceptList() {
  const { user } = useAuth();
  const [sheets, setSheets] = useState<ConceptSheetListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    (async () => {
      if (!user) return;
      // 네트워크 예외(throw)가 나도 스피너가 멈추도록 finally 에서 loading 을 내린다.
      try {
        const { data, error } = await supabase
          .from('concept_sheets')
          .select(LIST_COLUMNS)
          .order('updated_at', { ascending: false });

        if (error) {
          toast.error('개념지 목록을 불러오지 못했습니다.');
          return;
        }
        setSheets(data ?? []);
      } catch {
        toast.error('개념지 목록을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
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

  const selectCategory = useCallback((cat: Category) => {
    setSelectedCategory((prev) => (prev?.id === cat.id ? null : cat));
    setVisibleCount(PAGE_SIZE);
  }, []);

  const changeSearch = useCallback((q: string) => {
    setSearchQuery(q);
    setVisibleCount(PAGE_SIZE);
  }, []);

  const clearCategory = useCallback(() => {
    setSelectedCategory(null);
    setVisibleCount(PAGE_SIZE);
  }, []);

  const showMore = useCallback(() => setVisibleCount((c) => c + PAGE_SIZE), []);

  const deleteSheet = useCallback(async (id: string, title: string) => {
    if (!confirm(`"${title}" 개념지를 삭제하시겠습니까?`)) return;
    const { error } = await supabase.from('concept_sheets').delete().eq('id', id);
    if (error) {
      toast.error('삭제에 실패했습니다.');
      return;
    }
    setSheets((prev) => prev.filter((s) => s.id !== id));
    toast.success('개념지가 삭제되었습니다.');
  }, []);

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

  return {
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
  };
}
