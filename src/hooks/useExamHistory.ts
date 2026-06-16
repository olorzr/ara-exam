'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { buildCategoryTree } from '@/lib/category-tree';
import { toLocalDateString } from '@/lib/format';
import { MIN_EXAM_WORDS } from '@/lib/constants';
import { toast } from 'sonner';
import type { Category } from '@/types';

/** 한 번에 렌더링할 원본 시험(스레드) 수 — 렌더 비용 상한 */
const PAGE_SIZE = 30;

/**
 * 시험 이력 목록/필터에 필요한 컬럼만 조회한다.
 * 무거운 `word_ids`(시험당 수백 UUID 배열)는 목록에서 쓰지 않으므로 제외해
 * 전건 조회 시 네트워크·파싱 비용을 줄인다(상세는 view 페이지가 exam_words 로 로드).
 */
const EXAM_LIST_COLUMNS =
  'id,title,pass_percentage,total_questions,pass_count,parent_exam_id,retake_number,category_ids,created_at';

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

  // 렌더 페이지네이션(스레드 개수 상한)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    (async () => {
      if (!user) return;
      // 네트워크 예외(throw)가 나도 스피너가 멈추도록 finally 에서 loading 을 내린다.
      try {
        const [examRes, catRes] = await Promise.all([
          supabase.from('exams').select(EXAM_LIST_COLUMNS).order('created_at', { ascending: false }),
          supabase.from('categories').select('*').order('level').order('grade'),
        ]);
        setExams(examRes.data ?? []);
        setCategories(catRes.data ?? []);
      } catch {
        toast.error('시험 이력을 불러오지 못했어요.');
      } finally {
        setLoading(false);
      }
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
      if (dateFrom || dateTo) {
        const examDate = toLocalDateString(e.created_at);
        if (dateFrom && examDate < dateFrom) return false;
        if (dateTo && examDate > dateTo) return false;
      }
      if (filterCategoryIds.length > 0) {
        const examCatIds = e.category_ids ?? [];
        const hasOverlap = filterCategoryIds.some((id) => examCatIds.includes(id));
        if (!hasOverlap) return false;
      }
      return true;
    });
  }, [originalExams, searchQuery, dateFrom, dateTo, filterCategoryIds]);

  // 화면에 실제로 렌더링하는 스레드 목록(상한 적용). 수천 개를 한 번에 그리지 않는다.
  const visibleExams = useMemo(
    () => filteredExams.slice(0, visibleCount),
    [filteredExams, visibleCount],
  );
  const hasMore = filteredExams.length > visibleExams.length;
  const showMore = useCallback(() => setVisibleCount((c) => c + PAGE_SIZE), []);

  // 선택/전체선택은 화면에 보이는(visible) 항목 기준으로 동작한다.
  const isAllSelected = visibleExams.length > 0 && selectedIds.size === visibleExams.length;

  // 필터 변경 시 선택과 페이지 위치를 초기화하는 래퍼들
  const onSearchChange = (q: string) => { setSearchQuery(q); setSelectedIds(new Set()); setVisibleCount(PAGE_SIZE); };
  const onDateFromChange = (d: string) => { setDateFrom(d); setSelectedIds(new Set()); setVisibleCount(PAGE_SIZE); };
  const onDateToChange = (d: string) => { setDateTo(d); setSelectedIds(new Set()); setVisibleCount(PAGE_SIZE); };

  // 필터가 바뀌면 선택을 초기화한다. 그렇지 않으면 숨겨진(필터로 가려진) 행이
  // selectedIds 에 남아 일괄삭제가 화면에 보이지 않는 시험지를 지울 수 있다.
  const handleCategoryToggle = useCallback((id: string) => {
    setFilterCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setSelectedIds(new Set());
    setVisibleCount(PAGE_SIZE);
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
    setFilterCategoryIds([]);
    setSelectedIds(new Set());
    setVisibleCount(PAGE_SIZE);
  }, []);

  /** 선택 모드 종료 */
  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === visibleExams.length && visibleExams.length > 0) return new Set();
      return new Set(visibleExams.map((e) => e.id));
    });
  }, [visibleExams]);

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

    // 재시험은 서버(create_exam_with_words RPC)가 부모 exam_words 를 직접 읽어
    // 재조립하고 셔플 순서·차수·제목 접미사를 모두 서버가 결정한다. 클라이언트가
    // 보내는 p_words/p_word_ids/메타는 재시험 경로에서 전혀 사용되지 않으므로,
    // 별도 셔플 없이 부모 단어를 그대로 전달한다(원본 제목만 넘기고
    // p_retake_number 는 전달하지 않는다).
    const { data: newExamId, error: rpcErr } = await supabase.rpc(
      'create_exam_with_words',
      {
        p_title: originalExam.title,
        p_pass_percentage: originalExam.pass_percentage,
        p_total_questions: originalExam.total_questions,
        p_pass_count: originalExam.pass_count,
        p_category_ids: originalExam.category_ids,
        p_word_ids: originalWords.map((w) => w.word_id),
        p_words: originalWords.map((w, i) => ({
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
    visibleExams,
    hasMore,
    showMore,
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
