import { supabase } from '../supabase';
import type { Publisher } from '@/types';

/** 출판사 목록을 조회한다 */
export async function getPublishers(level?: string): Promise<Publisher[]> {
  let query = supabase.from('publishers').select('*').order('name');
  if (level) query = query.eq('level', level);
  const { data } = await query;
  return (data as Publisher[]) ?? [];
}

/** 출판사를 추가한다 */
export async function createPublisher(name: string, level: string) {
  return supabase.from('publishers').insert({ name, level }).select().single();
}

/** 출판사명을 수정하고, 관련 categories의 publisher도 동기화한다 */
export async function updatePublisher(id: string, name: string) {
  const { data: old, error: selectErr } = await supabase
    .from('publishers').select('name, level').eq('id', id).single();
  if (selectErr || !old) {
    return { error: selectErr ?? { message: '출판사를 찾을 수 없습니다.' } };
  }

  const { error: updateErr } = await supabase
    .from('publishers').update({ name }).eq('id', id);
  if (updateErr) return { error: updateErr };

  // DB 트리거가 있어도 앱 레벨에서도 동기화 시도 (안전장치)
  if (old.name !== name) {
    const { error: syncErr } = await supabase
      .from('categories')
      .update({ publisher: name })
      .eq('publisher', old.name)
      .eq('level', old.level);
    if (syncErr) return { error: syncErr };
  }

  return { error: null };
}

/** 출판사를 삭제한다 (하위 대단원/소단원도 CASCADE 삭제) */
export async function deletePublisher(id: string) {
  return supabase.from('publishers').delete().eq('id', id);
}
