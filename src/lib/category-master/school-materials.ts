import { supabase } from '../supabase';
import type { SchoolMaterial } from '@/types';

/** 프린트/작품명 목록을 조회한다 */
export async function getSchoolMaterials(schoolId: string): Promise<SchoolMaterial[]> {
  const { data } = await supabase
    .from('school_materials').select('*')
    .eq('school_id', schoolId).order('name');
  return (data as SchoolMaterial[]) ?? [];
}

/** 프린트/작품명을 추가한다 */
export async function createSchoolMaterial(name: string, schoolId: string) {
  return supabase.from('school_materials').insert({ name, school_id: schoolId }).select().single();
}

/** 프린트/작품명을 수정하고, 관련 categories의 chapter도 동기화한다 */
export async function updateSchoolMaterial(id: string, name: string) {
  const { data: old, error: selectErr } = await supabase
    .from('school_materials')
    .select('name, school_id, schools(name)')
    .eq('id', id)
    .single();
  if (selectErr || !old) {
    return { error: selectErr ?? { message: '항목을 찾을 수 없습니다.' } };
  }

  const { error: updateErr } = await supabase
    .from('school_materials').update({ name }).eq('id', id);
  if (updateErr) return { error: updateErr };

  if (old.name !== name) {
    const school = old.schools as unknown as { name: string };
    const { error: syncErr } = await supabase
      .from('categories')
      .update({ chapter: name })
      .eq('chapter', old.name)
      .eq('school_name', school.name)
      .eq('level', '외부지문 및 프린트');
    if (syncErr) return { error: syncErr };
  }

  return { error: null };
}

/** 프린트/작품명을 삭제한다 */
export async function deleteSchoolMaterial(id: string) {
  return supabase.from('school_materials').delete().eq('id', id);
}
