import { supabase } from '../supabase';
import type { School } from '@/types';

/** 학교 목록을 조회한다 */
export async function getSchools(): Promise<School[]> {
  const { data } = await supabase.from('schools').select('*').order('name');
  return (data as School[]) ?? [];
}

/** 학교를 추가한다 */
export async function createSchool(name: string) {
  return supabase.from('schools').insert({ name }).select().single();
}

/** 학교명을 수정하고, 관련 categories의 school_name도 동기화한다 */
export async function updateSchool(id: string, name: string) {
  const { data: old, error: selectErr } = await supabase
    .from('schools').select('name').eq('id', id).single();
  if (selectErr || !old) {
    return { error: selectErr ?? { message: '학교를 찾을 수 없습니다.' } };
  }

  const { error: updateErr } = await supabase
    .from('schools').update({ name }).eq('id', id);
  if (updateErr) return { error: updateErr };

  if (old.name !== name) {
    const { error: syncErr } = await supabase
      .from('categories')
      .update({ school_name: name })
      .eq('school_name', old.name)
      .eq('level', '외부지문 및 프린트');
    if (syncErr) return { error: syncErr };
  }

  return { error: null };
}

/** 학교를 삭제한다 (하위 프린트/작품명도 CASCADE 삭제) */
export async function deleteSchool(id: string) {
  return supabase.from('schools').delete().eq('id', id);
}
