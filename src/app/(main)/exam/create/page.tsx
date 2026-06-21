'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { Category, Word } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { CategoryTree } from '@/components/words';
import { FileText, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { DEFAULT_PASS_PERCENTAGE, PERCENTAGE_BASE, MIN_EXAM_WORDS, EXTERNAL_LEVEL } from '@/lib/constants';
import { buildCategoryTree } from '@/lib/category-tree';
import { shuffle } from '@/lib/shuffle';

/**
 * 시험지 생성 페이지 (트리 구조 카테고리 선택, 합격선 설정, 셔플 옵션)
 */
export default function ExamCreatePage() {
  const { user } = useAuth();
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCatIds, setSelectedCatIds] = useState<string[]>([]);
  const [words, setWords] = useState<Word[]>([]);
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
        return;
      }
      const { data } = await supabase
        .from('words')
        .select('*')
        .in('category_id', selectedCatIds)
        .order('order_index');
      setWords(data ?? []);
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

      toast.success('시험지가 생성되었습니다.');
      router.push(`/exam/view?id=${examId}`);
    } catch {
      toast.error('시험지 생성 중 오류가 발생했습니다.');
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">✏️ 시험지 생성</h1>

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
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" />
                미리보기
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">총 문항 수</span>
                  <span className="font-bold">{totalQuestions}문항</span>
                </div>
                {totalQuestions > 0 && totalQuestions < MIN_EXAM_WORDS && (
                  <p className="text-xs text-red-500 text-right">
                    최소 {MIN_EXAM_WORDS}문항 필요 (객관식 5지선다 보장)
                  </p>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">합격 기준</span>
                  <span className="font-bold">{passPercentage}%</span>
                </div>
                <Separator />
                <div className="flex justify-between text-primary">
                  <span className="font-medium">통과 기준</span>
                  <span className="font-bold">{passCount}개 이상 / {totalQuestions}문항</span>
                </div>
              </div>

              <Separator />

              <Button
                className="w-full bg-primary hover:bg-primary-hover text-white"
                onClick={handleCreate}
                disabled={creating || words.length < MIN_EXAM_WORDS}
              >
                <FileText className="h-4 w-4 mr-2" />
                {creating ? '생성 중...' : '시험지 생성'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
