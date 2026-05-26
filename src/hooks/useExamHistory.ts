'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { buildCategoryTree } from '@/lib/category-tree';
import { shuffle } from '@/lib/shuffle';
import { MIN_EXAM_WORDS } from '@/lib/constants';
import { toast } from 'sonner';
import type { Category } from '@/types';

export interface ExamRecord {
  id: string;
  title: string;
  pass_percentage: number;
  total_questions: number;
  pass_count: number;
  parent_exam_id: string | null;
  retake_number: number;
  category_ids: string[];
  created_at: string;
}

/**
 * 시험 이력 페이지의 상태·데이터·필터·선택모드·재시험 생성을 캡슐화한 훅.
 * 원본 시험 목록과 부모별 재시험 맵을 만들어 스레드 형태 렌더링을 지원한다.
 */
export function useExamHistory() {
  const { user } = useAuth();
  const router = useRouter();
  const [exams, setExams] = useState<ExamRecord[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [retestingId, setRetestingId] = useState<string | null>(null);

  // 필터 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterCategoryIds, setFilterCategoryIds] = useState<string[]>([]);

  // 선택 모드 상태
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      if (!user) return;
      const [examRes, catRes] = await Promise.all([
        supabase.from('exams').select('*').order('created_at', { ascending: false }),
        supabase.from('categories').select('*').order('level').order('grade'),
      ]);
      setExams(examRes.data ?? []);
      setCategories(catRes.data ?? []);
      setLoading(false);
    })();
  }, [user]);

  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);

  const originalExams = useMemo(
    () => exams.filter((e) => !e.parent_exam_id),
    [exams],
  );

  const retakeMap = useMemo(() => {
    const map = new Map<string, ExamRecord[]>();
    for (const e of exams) {
      if (!e.parent_exam_id) continue;
      const list = map.get(e.parent_exam_id) ?? [];
      list.push(e);
      map.set(e.parent_exam_id, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.retake_number - b.retake_number);
    }
    return map;
  }, [exams]);

  const hasActiveFilters = !!(searchQuery || dateFrom || dateTo || filterCategoryIds.length > 0);

  /** 모든 필터를 적용한 시험 목록 */
  const filteredExams = useMemo(() => {
    return originalExams.filter((e) => {
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        if (!e.title.toLowerCase().includes(q)) return false;
      }
      if (dateFrom) {
        const examDate = new Date(e.created_at).toISOString().slice(0, 10);
        if (examDate < dateFrom) return false;
      }
      if (dateTo) {
        const examDate = new Date(e.created_at).toISOString().slice(0, 10);
        if (examDate > dateTo) return false;
      }
      if (filterCategoryIds.length > 0) {
        const examCatIds = e.category_ids ?? [];
        const hasOverlap = filterCategoryIds.some((id) => examCatIds.includes(id));
        if (!hasOverlap) return false;
      }
      return true;
    });
  }, [originalExams, searchQuery, dateFrom, dateTo, filterCategoryIds]);

  const isAllSelected = filteredExams.length > 0 && selectedIds.size === filteredExams.length;

  // 필터 변경 시 선택을 초기화하는 래퍼들
  const onSearchChange = (q: string) => { setSearchQuery(q); setSelectedIds(new Set()); };
  const onDateFromChange = (d: string) => { setDateFrom(d); setSelectedIds(new Set()); };
  const onDateToChange = (d: string) => { setDateTo(d); setSelectedIds(new Set()); };

  const handleCategoryToggle = useCallback((id: string) => {
    setFilterCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
    setFilterCategoryIds([]);
  }, []);

  /** 선택 모드 종료 */
  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === filteredExams.length && filteredExams.length > 0) return new Set();
      return new Set(filteredExams.map((e) => e.id));
    });
  }, [filteredExams]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('이 시험지를 삭제할까요?')) return;
    const { error } = await supabase.from('exams').delete().eq('id', id);
    if (error) {
      toast.error('시험지 삭제에 실패했어요.');
      return;
    }
    setExams((prev) => prev.filter((e) => e.id !== id && e.parent_exam_id !== id));
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    toast.success('시험지가 삭제되었어요!');
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`선택한 ${selectedIds.size}개의 시험지를 삭제할까요?\n관련 재시험도 함께 삭제돼요!`)) return;
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from('exams').delete().in('id', ids);
    if (error) {
      toast.error('시험지 삭제에 실패했어요.');
      return;
    }
    setExams((prev) => prev.filter((e) => !ids.includes(e.id) && (!e.parent_exam_id || !ids.includes(e.parent_exam_id))));
    toast.success(`${ids.length}개의 시험지가 삭제되었어요!`);
    exitSelectMode();
  };

  const handleRetest = async (examId: string) => {
    if (!user) return;
    setRetestingId(examId);
    const originalExam = exams.find((e) => e.id === examId);
    if (!originalExam) { setRetestingId(null); return; }

    const { data: originalWords } = await supabase
      .from('exam_words').select('*').eq('exam_id', examId).order('order_index');
    if (!originalWords || originalWords.length === 0) {
      toast.error('원본 시험지의 단어를 불러올 수 없어요');
      setRetestingId(null);
      return;
    }
    if (originalWords.length < MIN_EXAM_WORDS) {
      toast.error(`재시험 생성에는 최소 ${MIN_EXAM_WORDS}개 단어가 필요해요 (현재 ${originalWords.length}개)`);
      setRetestingId(null);
      return;
    }

    const shuffled = shuffle(originalWords);

    // 차수와 제목 접미사는 서버(create_exam_with_words RPC)가 advisory lock 아래에서 결정한다.
    // 클라이언트는 원본 제목만 넘기고, p_retake_number 는 전달하지 않는다.
    const { data: newExamId, error: rpcErr } = await supabase.rpc(
      'create_exam_with_words',
      {
        p_title: originalExam.title,
        p_pass_percentage: originalExam.pass_percentage,
        p_total_questions: originalExam.total_questions,
        p_pass_count: originalExam.pass_count,
        p_category_ids: originalExam.category_ids,
        p_word_ids: shuffled.map((w) => w.word_id),
        p_words: shuffled.map((w, i) => ({
          word_id: w.word_id,
          word: w.word,
          meaning: w.meaning,
          order_index: i,
        })),
        p_parent_exam_id: examId,
      },
    );

    if (rpcErr || !newExamId) {
      toast.error('재시험지 생성 중 오류가 발생했어요');
      setRetestingId(null);
      return;
    }

    // 서버가 결정한 차수를 토스트/로컬 상태에 반영하기 위해 새 행을 한 번 더 조회한다.
    const { data: createdExam } = await supabase
      .from('exams')
      .select('*')
      .eq('id', newExamId)
      .single();

    if (createdExam) {
      setExams((prev) => [createdExam, ...prev]);
      toast.success(`재시험 ${createdExam.retake_number}차가 생성되었어요!`);
    } else {
      toast.success('재시험지가 생성되었어요!');
    }

    setRetestingId(null);
    router.push(`/exam/view?id=${newExamId}`);
  };

  return {
    loading,
    originalExams,
    filteredExams,
    categoryTree,
    retakeMap,
    retestingId,
    // 필터
    searchQuery,
    dateFrom,
    dateTo,
    filterCategoryIds,
    hasActiveFilters,
    onSearchChange,
    onDateFromChange,
    onDateToChange,
    handleCategoryToggle,
    clearFilters,
    // 선택 모드
    selectMode,
    setSelectMode,
    exitSelectMode,
    selectedIds,
    isAllSelected,
    toggleSelectAll,
    toggleSelect,
    // 액션
    handleDelete,
    handleBulkDelete,
    handleRetest,
  };
}
