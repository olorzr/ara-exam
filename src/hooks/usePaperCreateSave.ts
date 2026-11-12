'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { paperSaveProblem } from '@/lib/problem-paper/paper-validate';
import type { PaperComposer } from './usePaperComposer';

/**
 * 새 문제지를 저장한다 — 쓰기는 RPC 한 곳(`create_problem_paper`)이고 본문은 서버가 스냅샷으로 굳힌다.
 * @param paper - 조합 상태
 * @returns 저장 중 여부와 저장 동작(만들어진 문제지 id, 실패하면 null)
 */
export function usePaperCreateSave(paper: Pick<PaperComposer, 'items' | 'title' | 'settings' | 'omrPlan'>) {
  const [saving, setSaving] = useState(false);
  const { items, title, settings, omrPlan } = paper;

  const save = useCallback(async (): Promise<string | null> => {
    // OMR 을 골랐는데 채점할 수 없는 정답이면 **만들기 전에** 막는다 — 만들고 나면 성적 등록만 거절된다
    const problem = paperSaveProblem({ items, title, omrPlan }, 'create');
    if (problem) {
      toast.error(problem);
      return null;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('create_problem_paper', {
        p_title: title.trim(),
        p_problem_ids: items.map((i) => i.problemId),
        p_settings: settings,
      });
      if (error) throw error;
      return data as string;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '저장하지 못했어요.');
      return null;
    } finally {
      setSaving(false);
    }
  }, [items, settings, title, omrPlan]);

  return { saving, save };
}
