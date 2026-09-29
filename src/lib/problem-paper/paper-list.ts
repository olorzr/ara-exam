import { supabase } from '@/lib/supabase';
import { applyOwnerScope, type OwnerScope } from '@/lib/owner-scope';
import type { ProblemPaper } from '@/types/problem-bank';

/**
 * 만든 문제지 목록 조회·삭제.
 *
 * 페이지 안에 인라인으로 있던 것을 '내 것 / 다른 선생님 것' 탭을 붙이며 뗐다.
 */

/** 한 번에 보여 줄 문제지 수 — 탭마다 따로 센다 */
export const PAPER_LIST_LIMIT = 200;

/**
 * 문제지 목록 (최근 것부터).
 * @param scope - 내 것 / 다른 선생님 것
 * @param userId - 로그인한 사람의 id
 * @returns 문제지들
 * @throws 조회 실패 시
 */
export async function fetchPapers(scope: OwnerScope, userId: string): Promise<ProblemPaper[]> {
  const request = supabase.from('problem_papers').select('*');
  const { data, error } = await applyOwnerScope(request, scope, userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAPER_LIST_LIMIT);
  if (error) throw error;
  return (data ?? []) as ProblemPaper[];
}

/**
 * 문제지를 지운다. 담긴 문항은 아카이브에 그대로 남는다.
 *
 * ⚠️ `delete()` 는 0행을 지워도 error 가 null 이다 — 지운 행을 돌려받아 확인한다.
 * @param id - 문제지 id
 * @throws 지우지 못했을 때
 */
export async function deletePaper(id: string): Promise<void> {
  const { data, error } = await supabase.from('problem_papers').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('이미 지워졌거나 지울 수 없는 문제지예요. 새로고침 후 다시 확인해 주세요.');
  }
}
