'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { formatCategoryLabel } from '@/lib/format';
import { buildCategoryTree } from '@/lib/category-tree';
import {
  deleteWordsInCategory, moveWordsInCategory, updateWordInCategory,
} from '@/lib/words-mutations';
import { useCategoryWords } from './useCategoryWords';
import { toast } from 'sonner';
import type { Category, Word } from '@/types';

/** 단어 정렬 기준: asc(ㄱ~ㅎ), desc(ㅎ~ㄱ), order(등록순) */
export type WordSortOrder = 'asc' | 'desc' | 'order';

interface EditForm { word: string; meaning: string }

/** 쓰기가 일부만 됐을 때의 안내 — 나머지는 이미 지워졌거나 다른 카테고리로 옮겨졌다 */
const PARTIAL_WRITE_NOTICE = '나머지는 이미 지워졌거나 다른 카테고리로 옮겨졌어요. 목록을 다시 불러올게요.';

/**
 * 단어 관리 페이지의 상태·데이터 로딩·CRUD 핸들러를 캡슐화한 훅.
 * 카테고리 트리 탐색, 단어 조회/수정/삭제, 선택 모드(일괄 삭제·이동)를 제공한다.
 *
 * @param initialCategoryId - 처음 한 번 자동으로 펼쳐 보여 줄 카테고리
 *   (프린트 목록의 '단어 N개' 칩이 `?categoryId=` 로 넘겨준다).
 *   ⚠️ 주소는 **페이지가** 읽어 넘긴다 — 훅에서 `useSearchParams` 를 부르면 이 훅을 쓰는
 *   모든 화면이 Suspense 경계를 갖춰야 한다.
 */
export function useWordsManager(initialCategoryId?: string) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  /** 고른 카테고리의 단어 목록 — 그 카테고리의 응답일 때만 보인다. 아니면 어떤 쓰기도 하지 않는다 */
  const list = useCategoryWords(selectedCategory?.id ?? null);
  const {
    words, ready: wordsReady, loading: wordsLoading, failed: wordsFailed, reload: reloadWords,
    load: loadWords,
  } = list;
  const [searchQuery, setSearchQuery] = useState('');
  const [editWord, setEditWord] = useState<Word | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ word: '', meaning: '' });
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<WordSortOrder>('asc');

  const [selectMode, setSelectMode] = useState(false);
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);

  /** 주소로 건너온 카테고리는 **처음 목록을 읽을 때 한 번만** 펼친다 */
  const initialIdRef = useRef(initialCategoryId);

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
      const rows = data ?? [];
      setCategories(rows);

      // 주소로 건너왔으면 그 카테고리를 펼친 채 시작한다(프린트 목록의 '단어 N개' 칩).
      // ⚠️ 목록을 다 읽은 **바로 이 자리**에서 한 번만 한다 — 따로 효과를 두면 사람이 고른
      //    카테고리를 나중에 덮어쓸 수 있고, 못 찾은 경우(지워진 카테고리) 계속 다시 시도한다.
      const wanted = initialIdRef.current;
      initialIdRef.current = undefined;
      const found = wanted ? rows.find((c) => c.id === wanted) : undefined;
      if (found) {
        setSelectedCategory(found);
        await loadWords(found.id);
      }
      setLoading(false);
    })();
  }, [user, loadWords]);

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
    // 옛 카테고리의 체크를 들고 넘어가지 않는다 — 새 목록이 올 때까지 쓰기도 막힌다(`wordsReady`)
    exitSelectMode();
    setEditWord(null);
    setSelectedCategory(cat);
    void loadWords(cat.id);
  };

  /** 수정 다이얼로그 열기 */
  const startEdit = (word: Word) => {
    if (!wordsReady || !words.some((w) => w.id === word.id)) return;
    setEditWord(word);
    setEditForm({ word: word.word, meaning: word.meaning });
  };

  const handleDeleteWord = async (wordId: string) => {
    // ⚠️ 쓰기 직전에 대상을 다시 본다 — 지금 카테고리의 목록에 있는 행만 지운다
    if (!selectedCategory || !wordsReady || !words.some((w) => w.id === wordId)) return;
    if (!confirm('이 단어를 삭제하시겠습니까?')) return;
    const categoryId = selectedCategory.id;
    try {
      const deleted = await deleteWordsInCategory(categoryId, [wordId]);
      if (deleted.length === 0) {
        toast.error(`단어를 삭제하지 못했어요. ${PARTIAL_WRITE_NOTICE}`);
        list.reloadIfCurrent(categoryId);
        return;
      }
      list.drop(categoryId, deleted);
      toast.success('단어가 삭제되었습니다.');
    } catch {
      toast.error('단어 삭제에 실패했어요. 잠시 후 다시 시도해주세요.');
    }
  };

  const handleEditSave = async () => {
    if (!editWord || !selectedCategory) return;
    // 고르던 카테고리가 바뀌었으면 그 단어는 지금 화면의 것이 아니다
    if (editWord.category_id !== selectedCategory.id) {
      setEditWord(null);
      return;
    }
    // 신규 입력 경로와 동일하게 trim 한다. 공백이 섞인 중복어("apple " 등)가 생기면
    // 단어 중복 체크와 객관식 선지 dedupe(표시 문자열 기준)가 깨진다.
    const word = editForm.word.trim();
    const meaning = editForm.meaning.trim();
    if (!word || !meaning) {
      toast.error('단어와 뜻을 모두 입력해주세요.');
      return;
    }
    const categoryId = selectedCategory.id;
    const target = editWord.id;
    try {
      const updated = await updateWordInCategory(categoryId, target, { word, meaning });
      if (!updated) {
        toast.error(`단어를 수정하지 못했어요. ${PARTIAL_WRITE_NOTICE}`);
        setEditWord(null);
        list.reloadIfCurrent(categoryId);
        return;
      }
    } catch {
      toast.error('단어 수정에 실패했어요.');
      return;
    }
    list.patch(categoryId, target, { word, meaning });
    setEditWord(null);
    toast.success('단어가 수정되었습니다.');
  };

  /** 단어 선택 토글 */
  const toggleWordSelect = (wordId: string) => {
    if (!wordsReady) return;
    setSelectedWordIds((prev) => {
      const next = new Set(prev);
      if (next.has(wordId)) next.delete(wordId);
      else next.add(wordId);
      return next;
    });
  };

  /** 전체 선택/해제 — 지금 카테고리의 목록이 있을 때만 */
  const toggleSelectAll = () => {
    if (!wordsReady) return;
    if (selectedWordIds.size === words.length) {
      setSelectedWordIds(new Set());
    } else {
      setSelectedWordIds(new Set(words.map((w) => w.id)));
    }
  };

  /**
   * 쓰기 대상 — 체크한 것 가운데 **지금 카테고리의 목록에 있는 것만**.
   * ⚠️ 목록을 읽는 중·실패면 빈 집합이다(옛 카테고리 목록으로 쓰지 않는다).
   */
  const targetIds = (): string[] => (wordsReady
    ? words.filter((w) => selectedWordIds.has(w.id)).map((w) => w.id)
    : []);

  /** 선택한 단어 일괄 삭제 */
  const handleBulkDelete = async () => {
    const ids = targetIds();
    if (!selectedCategory || ids.length === 0) return;
    if (!confirm(`선택한 ${ids.length}개의 단어를 삭제하시겠습니까?`)) return;
    const categoryId = selectedCategory.id;
    try {
      const deleted = await deleteWordsInCategory(categoryId, ids);
      list.drop(categoryId, deleted);
      // 그 사이 다른 카테고리로 옮겼으면 그쪽의 선택을 건드리지 않는다(코덱스 1R)
      if (list.isCurrent(categoryId)) exitSelectMode();
      if (deleted.length < ids.length) {
        toast.warning(`${ids.length}개 중 ${deleted.length}개만 삭제했어요. ${PARTIAL_WRITE_NOTICE}`);
        list.reloadIfCurrent(categoryId);
        return;
      }
      toast.success(`${ids.length}개의 단어가 삭제되었습니다.`);
    } catch {
      toast.error('단어 삭제에 실패했어요.');
    }
  };

  /** 카테고리 삭제 (words.category_id ON DELETE CASCADE로 단어도 함께 삭제) */
  const handleDeleteCategory = async () => {
    // 목록을 읽는 중이면 '포함된 단어 N개' 가 거짓이 된다 — 다 읽은 뒤(또는 실패를 본 뒤)에 묻는다
    if (!selectedCategory || wordsLoading) return;
    const label = formatCategoryLabel(selectedCategory);
    const included = wordsReady ? `포함된 단어 ${words.length}개도` : '포함된 단어도 모두';
    if (!confirm(`"${label}" 카테고리를 삭제하시겠습니까?\n${included} 함께 삭제됩니다.`)) return;
    const { error } = await supabase
      .from('categories').delete().eq('id', selectedCategory.id);
    if (error) {
      toast.error('카테고리 삭제에 실패했어요.');
      return;
    }
    setCategories((prev) => prev.filter((c) => c.id !== selectedCategory.id));
    setSelectedCategory(null);
    list.clear();
    toast.success('카테고리가 삭제되었습니다.');
  };

  /** 선택한 단어를 다른 카테고리로 이동 */
  const handleMoveConfirm = async (targetCategory: Category) => {
    const ids = targetIds();
    if (!selectedCategory || ids.length === 0 || targetCategory.id === selectedCategory.id) return;
    const categoryId = selectedCategory.id;
    try {
      const moved = await moveWordsInCategory(categoryId, ids, targetCategory.id);
      list.drop(categoryId, moved);
      setMoveDialogOpen(false);
      if (list.isCurrent(categoryId)) exitSelectMode();
      if (moved.length < ids.length) {
        toast.warning(`${ids.length}개 중 ${moved.length}개만 이동했어요. ${PARTIAL_WRITE_NOTICE}`);
        list.reloadIfCurrent(categoryId);
        return;
      }
      toast.success(`${ids.length}개의 단어가 이동되었습니다.`);
    } catch {
      toast.error('단어 이동에 실패했어요.');
    }
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
    wordsLoading,
    wordsFailed,
    reloadWords,
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
