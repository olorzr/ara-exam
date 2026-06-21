'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { formatCategoryLabel } from '@/lib/format';
import { buildCategoryTree } from '@/lib/category-tree';
import { toast } from 'sonner';
import type { Category, Word } from '@/types';

/** 단어 정렬 기준: asc(ㄱ~ㅎ), desc(ㅎ~ㄱ), order(등록순) */
export type WordSortOrder = 'asc' | 'desc' | 'order';

interface EditForm {
  word: string;
  meaning: string;
}

/**
 * 단어 관리 페이지의 상태·데이터 로딩·CRUD 핸들러를 캡슐화한 훅.
 * 카테고리 트리 탐색, 단어 조회/수정/삭제, 선택 모드(일괄 삭제·이동)를 제공한다.
 */
export function useWordsManager() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editWord, setEditWord] = useState<Word | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ word: '', meaning: '' });
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<WordSortOrder>('asc');

  // 선택 모드 상태
  const [selectMode, setSelectMode] = useState(false);
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase
        .from('categories')
        .select('*')
        .order('level')
        .order('grade')
        .order('publisher')
        .order('chapter');
      setCategories(data ?? []);
      setLoading(false);
    })();
  }, [user]);

  const loadWords = useCallback(async (categoryId: string) => {
    const { data } = await supabase
      .from('words')
      .select('*')
      .eq('category_id', categoryId)
      .order('order_index');
    setWords(data ?? []);
  }, []);

  /** 정렬된 단어 목록 */
  const sortedWords = useMemo(() => {
    if (sortOrder === 'order') return words;
    return [...words].sort((a, b) => {
      const cmp = a.word.localeCompare(b.word, 'ko');
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [words, sortOrder]);

  /** 선택 모드 종료 */
  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedWordIds(new Set());
  }, []);

  const handleSelectCategory = (cat: Category) => {
    setSelectedCategory(cat);
    loadWords(cat.id);
    exitSelectMode();
  };

  /** 수정 다이얼로그 열기 */
  const startEdit = (word: Word) => {
    setEditWord(word);
    setEditForm({ word: word.word, meaning: word.meaning });
  };

  const handleDeleteWord = async (wordId: string) => {
    if (!confirm('이 단어를 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('words').delete().eq('id', wordId);
    if (error) {
      toast.error('단어 삭제에 실패했어요. 잠시 후 다시 시도해주세요.');
      return;
    }
    setWords((prev) => prev.filter((w) => w.id !== wordId));
    toast.success('단어가 삭제되었습니다.');
  };

  const handleEditSave = async () => {
    if (!editWord) return;
    // 신규 입력 경로와 동일하게 trim 한다. 공백이 섞인 중복어("apple " 등)가 생기면
    // 단어 중복 체크와 객관식 선지 dedupe(표시 문자열 기준)가 깨진다.
    const word = editForm.word.trim();
    const meaning = editForm.meaning.trim();
    if (!word || !meaning) {
      toast.error('단어와 뜻을 모두 입력해주세요.');
      return;
    }
    const { error } = await supabase
      .from('words')
      .update({ word, meaning })
      .eq('id', editWord.id);
    if (error) {
      toast.error('단어 수정에 실패했어요.');
      return;
    }
    setWords((prev) =>
      prev.map((w) => (w.id === editWord.id ? { ...w, word, meaning } : w))
    );
    setEditWord(null);
    toast.success('단어가 수정되었습니다.');
  };

  /** 단어 선택 토글 */
  const toggleWordSelect = (wordId: string) => {
    setSelectedWordIds((prev) => {
      const next = new Set(prev);
      if (next.has(wordId)) next.delete(wordId);
      else next.add(wordId);
      return next;
    });
  };

  /** 전체 선택/해제 */
  const toggleSelectAll = () => {
    if (selectedWordIds.size === words.length) {
      setSelectedWordIds(new Set());
    } else {
      setSelectedWordIds(new Set(words.map((w) => w.id)));
    }
  };

  /** 선택한 단어 일괄 삭제 */
  const handleBulkDelete = async () => {
    if (!confirm(`선택한 ${selectedWordIds.size}개의 단어를 삭제하시겠습니까?`)) return;
    const ids = Array.from(selectedWordIds);
    const { error } = await supabase.from('words').delete().in('id', ids);
    if (error) {
      toast.error('단어 삭제에 실패했어요.');
      return;
    }
    setWords((prev) => prev.filter((w) => !selectedWordIds.has(w.id)));
    toast.success(`${ids.length}개의 단어가 삭제되었습니다.`);
    exitSelectMode();
  };

  /** 카테고리 삭제 (words.category_id ON DELETE CASCADE로 단어도 함께 삭제) */
  const handleDeleteCategory = async () => {
    if (!selectedCategory) return;
    const label = formatCategoryLabel(selectedCategory);
    if (!confirm(`"${label}" 카테고리를 삭제하시겠습니까?\n포함된 단어 ${words.length}개도 함께 삭제됩니다.`)) return;
    const { error } = await supabase
      .from('categories').delete().eq('id', selectedCategory.id);
    if (error) {
      toast.error('카테고리 삭제에 실패했어요.');
      return;
    }
    setCategories((prev) => prev.filter((c) => c.id !== selectedCategory.id));
    setSelectedCategory(null);
    setWords([]);
    toast.success('카테고리가 삭제되었습니다.');
  };

  /** 선택한 단어를 다른 카테고리로 이동 */
  const handleMoveConfirm = async (targetCategory: Category) => {
    const ids = Array.from(selectedWordIds);
    const { error } = await supabase
      .from('words').update({ category_id: targetCategory.id }).in('id', ids);
    if (error) {
      toast.error('단어 이동에 실패했어요.');
      return;
    }
    setWords((prev) => prev.filter((w) => !selectedWordIds.has(w.id)));
    setMoveDialogOpen(false);
    toast.success(`${ids.length}개의 단어가 이동되었습니다.`);
    exitSelectMode();
  };

  /** 검색어로 필터링한 카테고리 트리 */
  const tree = useMemo(() => {
    const filtered = categories.filter((cat) => {
      if (!searchQuery) return true;
      const label = formatCategoryLabel(cat).toLowerCase();
      return label.includes(searchQuery.toLowerCase()) || cat.level.includes(searchQuery);
    });
    return buildCategoryTree(filtered);
  }, [categories, searchQuery]);

  return {
    categories,
    selectedCategory,
    words,
    sortedWords,
    searchQuery,
    setSearchQuery,
    editWord,
    setEditWord,
    editForm,
    setEditForm,
    loading,
    sortOrder,
    setSortOrder,
    selectMode,
    setSelectMode,
    selectedWordIds,
    moveDialogOpen,
    setMoveDialogOpen,
    tree,
    handleSelectCategory,
    startEdit,
    handleDeleteWord,
    handleEditSave,
    exitSelectMode,
    toggleWordSelect,
    toggleSelectAll,
    handleBulkDelete,
    handleDeleteCategory,
    handleMoveConfirm,
  };
}
