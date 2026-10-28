import { supabase } from '@/lib/supabase';
import type { ReferenceTextPayload } from './form';

/**
 * 작품 전문 · 개념 쓰기 (sql/30) — **원장만** 된다(sql/84 RLS, 읽기는 도메인 전원).
 *
 * ⚠️ `user_id` 와 `char_count` 를 보내지 않는다 — DB 트리거가 채우고(UPDATE 에서 잠근다),
 *    보내도 무시된다.
 */

/** 원장이 아닌 계정이 쓰려 할 때(sql/84 RLS 위반, PostgREST 42501) 보여 줄 말 */
export const REFERENCE_OWNER_ONLY_MESSAGE = '작품 전문·개념은 원장님만 올리고 고칠 수 있어요.';

/**
 * 쓰기 오류를 사람이 읽을 말로 — RLS 위반(42501)이면 원장 전용이라고 알린다.
 * @param error - PostgREST 오류
 * @returns 던질 오류
 */
function writeError(error: { code?: string; message?: string }): Error {
  if (error.code === '42501') return new Error(REFERENCE_OWNER_ONLY_MESSAGE);
  return error instanceof Error ? error : new Error(error.message ?? '저장하지 못했어요.');
}

/** 저장 뒤 돌려받는 버전 — 다음 저장의 낙관적 동시성 기준이다 */
export interface ReferenceTextVersion {
  id: string;
  updated_at: string;
}

/**
 * 전문을 새로 만든다.
 * @param payload - 제목·지은이·본문
 * @returns 만들어진 id 와 버전
 * @throws 저장 실패 시
 */
export async function insertReferenceText(
  payload: ReferenceTextPayload,
): Promise<ReferenceTextVersion> {
  const { data, error } = await supabase
    .from('reference_texts')
    .insert(payload)
    .select('id, updated_at')
    .single();
  if (error) throw writeError(error);
  if (!data) throw new Error('전문을 저장하지 못했어요.');
  return { id: data.id as string, updated_at: data.updated_at as string };
}

/**
 * 전문을 고친다 (낙관적 동시성).
 *
 * `reference_texts` 는 도메인 전원이 함께 쓰는 표라, 두 사람이 같은 전문을 열어 두면
 * 마지막 저장이 상대 변경을 통째로 덮는다. 불러올 때의 `updated_at` 과 같을 때만 고친다.
 * @param id - 전문 id
 * @param payload - 바꿀 값
 * @param loadedUpdatedAt - 불러올 때의 버전 (없으면 검사하지 않는다)
 * @returns 새 버전. 그 사이 남이 먼저 고쳤으면 null
 * @throws 저장 실패 시
 */
export async function updateReferenceText(
  id: string,
  payload: ReferenceTextPayload,
  loadedUpdatedAt: string | null,
): Promise<{ updated_at: string } | null> {
  let request = supabase.from('reference_texts').update(payload).eq('id', id);
  if (loadedUpdatedAt) request = request.eq('updated_at', loadedUpdatedAt);

  const { data, error } = await request.select('updated_at').maybeSingle();
  if (error) throw writeError(error);
  if (!data) return null;
  return { updated_at: data.updated_at as string };
}

/**
 * 전문을 지운다.
 *
 * ⚠️ `supabase.delete()` 는 **0행을 지워도 error 가 null** 이다. 지운 행을 돌려받아
 *    비어 있으면 던진다 — 안 그러면 "성공 토스트가 뜨는데 목록에는 그대로" 가 된다
 *    (`print-scan/save.ts` 와 같은 규약).
 * @param id - 전문 id
 * @throws 지우지 못했을 때
 */
export async function deleteReferenceText(id: string): Promise<void> {
  const { data, error } = await supabase
    .from('reference_texts')
    .delete()
    .eq('id', id)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('이미 지워졌거나 지울 권한이 없어요. 새로고침 후 다시 확인해 주세요.');
  }
}
