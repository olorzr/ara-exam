import { isAdminEmail } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import { applyOwnerScope, type OwnerScope } from '@/lib/owner-scope';
import type { ProblemPaper } from '@/types/problem-bank';

/**
 * 만든 문제지 목록 조회·삭제.
 *
 * 페이지 안에 인라인으로 있던 것을 '내 것 / 다른 선생님 것' 탭을 붙이며 뗐다.
 */

/** 참조 무결성 위반(foreign_key_violation) — 책에 담긴 문제지를 지우려 할 때 */
const BOOK_REFERENCE_VIOLATION = '23503';

/** 책에 담긴 문제지를 지우려 할 때의 안내 */
export const PAPER_IN_BOOK_MESSAGE =
  '원장님이 만드는 책에 담긴 문제지라 지울 수 없어요. 책 만들기에서 먼저 빼야 지울 수 있어요.';

/** 지운 행이 없을 때 — 이미 지워졌거나 남의 문제지다(DB 가 0행으로 막는다, sql/104) */
export const PAPER_DELETE_DENIED_MESSAGE =
  '이미 지워졌거나, 만든 선생님과 원장님만 지울 수 있는 문제지예요. 새로고침 후 다시 확인해 주세요.';

/** 문제지를 보는 사람 */
export interface PaperViewer {
  userId: string;
  email: string | null | undefined;
}

/**
 * 이 문제지를 지울 수 있는가 — 만든 선생님 또는 원장(2026-11-13 원장 결정, sql/104).
 * 권위는 DB 정책이고 이건 화면 게이트다(지울 수 없는 문제지에는 단추를 그리지 않는다). 책에 담긴 문제지는 원장도 못 지우는데
 * 그것은 DB 가 23503 으로 알려 준다(선생님은 책을 못 읽어 미리 알 수 없다).
 * @param paper - 문제지(만든 사람 id)
 * @param viewer - 로그인한 사람
 * @returns 지울 수 있으면 true
 */
export function canDeletePaper(paper: Pick<ProblemPaper, 'user_id'>, viewer: PaperViewer): boolean {
  if (isAdminEmail(viewer.email)) return true;
  return viewer.userId !== '' && paper.user_id === viewer.userId;
}

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
 * @throws 지우지 못했을 때 — 책에 담긴 문제지면 `PAPER_IN_BOOK_MESSAGE`
 */
export async function deletePaper(id: string): Promise<void> {
  const { data, error } = await supabase.from('problem_papers').delete().eq('id', id).select('id');
  // 원장님 책에 담긴 문제지는 DB 가 막는다(sql/76 RESTRICT). 선생님은 책을 볼 수 없어 원인을 알 길이 없으니 말해 준다
  if (error?.code === BOOK_REFERENCE_VIOLATION) throw new Error(PAPER_IN_BOOK_MESSAGE);
  if (error) throw error;
  // 남의 문제지면 RLS 가 오류 없이 0행으로 거른다(sql/104) — 이미 지워진 것과 구별할 수 없어 둘 다 말한다
  if (!data || data.length === 0) throw new Error(PAPER_DELETE_DENIED_MESSAGE);
}
