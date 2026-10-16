import { supabase } from './supabase';
import type { Word } from '@/types';

/**
 * 단어 관리 화면의 조회·쓰기 — **카테고리 안으로 좁힌다** (2026-10-15 리뷰 1번).
 *
 * ⚠️ 쓰기는 모두 `category_id` 를 조건에 건다. 화면이 들고 있는 목록이 어느 카테고리의 것인지
 *    어긋나면(빠르게 고르는 사이 늦게 온 응답) 예전에는 **다른 카테고리의 단어**가 수정·삭제·이동됐다.
 *    화면도 지금 카테고리의 목록만 쓰게 막지만, 마지막 관문은 DB 조건이다.
 * ⚠️ PostgREST 의 수정·삭제는 **0행이어도 error 가 null** 이다. 바뀐 행을 돌려받아 호출부가
 *    "전부 됐는가" 를 직접 본다(`deleteScan`·`deleteReferenceText` 와 같은 규약).
 */

/**
 * 한 카테고리의 단어를 읽는다.
 * @param categoryId - 카테고리 id
 * @returns 등록순 단어 목록
 * @throws 조회 실패 시 — 빈 목록으로 물러서면 '단어가 없다' 로 잘못 읽힌다
 */
export async function fetchCategoryWords(categoryId: string): Promise<Word[]> {
  const { data, error } = await supabase
    .from('words')
    .select('*')
    .eq('category_id', categoryId)
    .order('order_index')
    .order('id');
  if (error) throw error;
  return (data ?? []) as Word[];
}

/** 돌려받은 행 → id 목록 */
function idsOf(data: { id: string }[] | null): string[] {
  return (data ?? []).map((row) => row.id);
}

/**
 * 그 카테고리 안의 단어만 지운다.
 * @param categoryId - 지금 고른 카테고리 id
 * @param ids - 지울 단어 id
 * @returns 실제로 지운 id (카테고리 밖이거나 이미 없는 것은 빠진다)
 * @throws 저장소 오류 시
 */
export async function deleteWordsInCategory(categoryId: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('words')
    .delete()
    .in('id', ids)
    .eq('category_id', categoryId)
    .select('id');
  if (error) throw error;
  return idsOf(data as { id: string }[] | null);
}

/**
 * 그 카테고리 안의 단어만 다른 카테고리로 옮긴다.
 * @param fromCategoryId - 지금 고른 카테고리 id
 * @param ids - 옮길 단어 id
 * @param toCategoryId - 옮겨 갈 카테고리 id
 * @returns 실제로 옮긴 id
 * @throws 저장소 오류 시 (옮겨 갈 곳에 같은 단어가 있으면 유니크 위반)
 */
export async function moveWordsInCategory(
  fromCategoryId: string,
  ids: string[],
  toCategoryId: string,
): Promise<string[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('words')
    .update({ category_id: toCategoryId })
    .in('id', ids)
    .eq('category_id', fromCategoryId)
    .select('id');
  if (error) throw error;
  return idsOf(data as { id: string }[] | null);
}

/**
 * 그 카테고리 안의 단어 하나를 고친다.
 * @param categoryId - 지금 고른 카테고리 id
 * @param id - 단어 id
 * @param patch - 다듬은 단어·뜻
 * @returns 고쳤으면 true (카테고리 밖이거나 이미 없으면 false)
 * @throws 저장소 오류 시
 */
export async function updateWordInCategory(
  categoryId: string,
  id: string,
  patch: { word: string; meaning: string },
): Promise<boolean> {
  const { data, error } = await supabase
    .from('words')
    .update(patch)
    .eq('id', id)
    .eq('category_id', categoryId)
    .select('id');
  if (error) throw error;
  return idsOf(data as { id: string }[] | null).length > 0;
}
