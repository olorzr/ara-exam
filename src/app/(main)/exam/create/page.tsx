'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { Category, Word } from '@/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { CategoryTree } from '@/components/words';
import NaesinScopeLoader from '@/components/exam/NaesinScopeLoader';
import ExamCreatePreview from '@/components/exam/ExamCreatePreview';
import { toast } from 'sonner';
import { DEFAULT_PASS_PERCENTAGE, PERCENTAGE_BASE, MIN_EXAM_WORDS, EXTERNAL_LEVEL } from '@/lib/constants';
import { buildCategoryTree } from '@/lib/category-tree';
import { shuffle } from '@/lib/shuffle';
import { fireGradeSync } from '@/lib/grade-sync-client';
import { fetchWordsByCategories, MAX_EXAM_WORDS } from '@/lib/words-fetch';

/**
 * 시험지 생성 페이지 (트리 구조 카테고리 선택, 합격선 설정, 셔플 옵션)
 */
export default function ExamCreatePage() {
  const { user } = useAuth();
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCatIds, setSelectedCatIds] = useState<string[]>([]);
  const [words, setWords] = useState<Word[]>([]);
  // 고른 카테고리의 단어가 상한을 넘었다 — 잘린 채로 만들면 인쇄물과 성적이 조용히 어긋난다.
  const [overLimit, setOverLimit] = useState(false);
  const [title, setTitle] = useState('');
  const [passPercentage, setPassPercentage] = useState(DEFAULT_PASS_PERCENTAGE);
  const [shuffleEnabled, setShuffleEnabled] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase
        .from('categories')
        .select('*')
        .order('level')
        .order('grade');
      setCategories(data ?? []);
    })();
  }, [user]);

  useEffect(() => {
    (async () => {
      if (selectedCatIds.length === 0) {
        setWords([]);
        setOverLimit(false);
        return;
      }
      try {
        // ⚠️ 여기서 `.range()` 없이 한 번에 청하면 1,000행에서 조용히 잘린다(fetchWordsByCategories 주석).
        const { words: rows, overLimit: over } = await fetchWordsByCategories(selectedCatIds);
        setWords(rows);
        setOverLimit(over);
        if (over) {
          toast.error(`단어가 ${MAX_EXAM_WORDS}개를 넘어 시험을 만들 수 없어요. 카테고리를 나눠서 만들어주세요`);
        }
      } catch {
        // 빈 목록으로 두면 '이 카테고리에 단어가 없다' 로 잘못 읽힌다 — 실패를 밝힌다.
        setWords([]);
        setOverLimit(false);
        toast.error('단어를 불러오지 못했어요. 잠시 후 다시 시도해주세요');
      }
    })();
  }, [selectedCatIds]);

  /** 선택된 카테고리로 자동 제목을 생성한다 */
  const generateTitle = useCallback((catIds: string[]) => {
    const selected = categories.filter((c) => catIds.includes(c.id));
    if (selected.length === 0) return '';

    const isExternal = selected[0].level === EXTERNAL_LEVEL;
    if (isExternal) {
      const schools = [...new Set(selected.map((c) => c.school_name).filter(Boolean))];
      const chapters = [...new Set(selected.map((c) => c.chapter).filter(Boolean))];
      const parts = [...schools, ...chapters].slice(0, 3);
      return parts.length > 0 ? `${parts.join(' ')} 단어시험` : '';
    }

    const grades = [...new Set(selected.map((c) => c.grade))];
    const publishers = [...new Set(selected.map((c) => c.publisher))];
    const chapters = [...new Set(selected.map((c) => c.chapter).filter(Boolean))];

    const parts: string[] = [];
    if (grades.length === 1) parts.push(grades[0]);
    if (publishers.length === 1) parts.push(publishers[0]);
    if (chapters.length <= 2) parts.push(...chapters);
    else parts.push(`${chapters[0]} 외 ${chapters.length - 1}개`);

    return parts.length > 0 ? `${parts.join(' ')} 단어시험` : '';
  }, [categories]);

  const [titleManuallyEdited, setTitleManuallyEdited] = useState(false);

  const toggleCategory = (catId: string) => {
    setSelectedCatIds((prev) => {
      const next = prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId];
      if (!titleManuallyEdited) {
        setTitle(generateTitle(next));
      }
      return next;
    });
  };

  /** 내신 시험범위 불러오기 → 매칭된 카테고리를 기존 선택에 합집합으로 반영한다 */
  const applyScopeCategories = (ids: string[]) => {
    setSelectedCatIds((prev) => {
      const next = [...new Set([...prev, ...ids])];
      if (!titleManuallyEdited) {
        setTitle(generateTitle(next));
      }
      return next;
    });
  };

  const totalQuestions = words.length;
  const passCount = Math.ceil((passPercentage / PERCENTAGE_BASE) * totalQuestions);

  const tree = buildCategoryTree(categories);

  const handleCreate = async () => {
    if (!user) return;
    if (!title.trim()) {
      toast.error('시험지 제목을 입력해주세요.');
      return;
    }
    if (words.length === 0) {
      toast.error('카테고리를 선택해주세요.');
      return;
    }
    if (words.length < MIN_EXAM_WORDS) {
      toast.error(`객관식 시험을 지원하려면 최소 ${MIN_EXAM_WORDS}개 이상의 단어가 필요합니다. (현재 ${words.length}개)`);
      return;
    }
    // ⚠️ 상한을 넘으면 **만들지 않는다**. 만들 수는 있지만 시험지·성적 등록이 앞 1,000개만
    //   보게 되어(둘 다 1,000행에서 잘린다) 시험 날에야 어긋남을 알게 된다.
    if (overLimit) {
      toast.error(`단어가 ${MAX_EXAM_WORDS}개를 넘어요. 카테고리를 나눠서 여러 시험으로 만들어주세요`);
      return;
    }

    setCreating(true);

    // RPC 가 네트워크 오류 등으로 throw 해도 생성 스피너가 멈추지 않도록 감싼다.
    // 성공 시에는 페이지 이동(router.push)으로 언마운트되므로 creating 을 굳이
    // 되돌리지 않는다(언마운트 후 setState 경고 방지).
    try {
      const orderedWords = shuffleEnabled ? shuffle(words) : words;

      const { data: examId, error: rpcErr } = await supabase.rpc(
        'create_exam_with_words',
        {
          p_title: title.trim(),
          p_pass_percentage: passPercentage,
          p_total_questions: totalQuestions,
          p_pass_count: passCount,
          p_category_ids: selectedCatIds,
          p_word_ids: orderedWords.map((w) => w.id),
          p_words: orderedWords.map((w, i) => ({
            word_id: w.id,
            word: w.word,
            meaning: w.meaning,
            order_index: i,
          })),
        },
      );

      if (rpcErr || !examId) {
        toast.error('시험지 생성 중 오류가 발생했습니다.');
        setCreating(false);
        return;
      }

      // 학원 성적 자동 등록: ara-system 성적에 시험 정의를 멱등 등록한다.
      // 전송·실패 알림 규약은 grade-sync-client 한 곳에 있다(개념지 저장과 공유).
      fireGradeSync('/api/sync-to-grades', { examId });

      toast.success('시험지가 생성되었습니다.');
      router.push(`/exam/view?id=${examId}`);
    } catch {
      toast.error('시험지 생성 중 오류가 발생했습니다.');
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">✏️ 단어 시험지 생성</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 설정 */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">시험지 설정</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>시험지 제목</Label>
                <Input
                  placeholder="예: 중2 비상 Lesson 1 단어시험"
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); setTitleManuallyEdited(true); }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>합격 기준 (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={passPercentage}
                    onChange={(e) => setPassPercentage(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2 flex items-end">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="shuffle"
                      checked={shuffleEnabled}
                      onCheckedChange={(v) => setShuffleEnabled(v === true)}
                    />
                    <Label htmlFor="shuffle">문제 순서 섞기</Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 내신 시험범위 불러오기 (ara-system 수업 > 내신 관리 연동) */}
          <NaesinScopeLoader categories={categories} onApply={applyScopeCategories} />

          {/* 카테고리 트리 선택 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">카테고리 선택</CardTitle>
            </CardHeader>
            <CardContent>
              <CategoryTree
                nodes={tree}
                selectedIds={selectedCatIds}
                onToggle={toggleCategory}
                multiSelect
              />
              {categories.length === 0 && (
                <p className="text-center text-gray-500 py-4">
                  카테고리가 없습니다. 먼저 단어를 추가해주세요.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 오른쪽: 미리보기 */}
        <div className="space-y-4">
          <ExamCreatePreview
            totalQuestions={totalQuestions}
            passPercentage={passPercentage}
            passCount={passCount}
            creating={creating}
            onCreate={handleCreate}
          />
        </div>
      </div>
    </div>
  );
}
