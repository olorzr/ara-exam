'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { buildCategoryTree } from '@/lib/category-tree';
import { conceptCategoryKey, conceptSheetToCategory } from '@/lib/concept-category';
import { toast } from 'sonner';
import type { ConceptSheetListItem, Category } from '@/types';

/** 한 번에 렌더링할 개념지 카드 수(스크롤 렌더 비용 상한) */
const PAGE_SIZE = 24;

/** 목록/트리에 필요한 컬럼만 조회한다(무거운 editor_html 제외) */
const LIST_COLUMNS =
  'id,title,level,year,grade,publisher,semester,unit,subunit,school_name,marks,user_id,created_at,updated_at';

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

  /**
   * 개념지 카테고리 필드로 합성 Category를 생성하여 트리를 구성한다.
   * 키는 `conceptCategoryKey` 가 정규화하므로 `천재(정호웅)` / `천재 (정호웅)` 처럼
   * 표기만 다른 개념지가 한 노드로 합쳐진다. 키에 학교명·년도를 포함하는 것은
   * 그대로다 — 빼면 학교·년도가 다른 외부지문 개념지가 한 노드로 뭉친다.
   */
  const tree = useMemo(() => {
    const seen = new Map<string, Category>();
    for (const s of sheets) {
      const cat = conceptSheetToCategory(s);
      if (!seen.has(cat.id)) {
        seen.set(cat.id, cat);
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
      // 트리 노드와 같은 정규화 키로 비교한다. 원시 문자열로 비교하면 합쳐진 노드를
      // 눌렀을 때 다른 표기로 저장된 개념지가 조용히 빠진다.
      const targetKey = conceptCategoryKey(selectedCategory);
      result = result.filter((s) => conceptSheetToCategory(s).id === targetKey);
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
