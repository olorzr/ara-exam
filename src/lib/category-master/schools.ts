import { supabase } from '../supabase';
import { normalizeCategoryName } from '../category-name';
import { EXTERNAL_LEVEL } from '../constants';
import type { School } from '@/types';

/** 학교 목록을 조회한다 */
export async function getSchools(): Promise<School[]> {
  const { data } = await supabase.from('schools').select('*').order('name');
  return (data as School[]) ?? [];
}

/** 학교를 추가한다 */
export async function createSchool(name: string) {
  return supabase.from('schools').insert({ name: normalizeCategoryName(name) }).select().single();
}

/** 학교명을 수정하고, 관련 categories/concept_sheets 의 school_name 도 동기화한다 */
export async function updateSchool(id: string, rawName: string) {
  // 표기 변형(공백·전각 괄호 등)을 그대로 저장하면 트리에서 같은 이름이 두 폴더로 갈라진다
  const name = normalizeCategoryName(rawName);

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
      .eq('level', EXTERNAL_LEVEL);
    if (syncErr) return { error: syncErr };

    const { error: sheetSyncErr } = await supabase
      .from('concept_sheets')
      .update({ school_name: name })
      .eq('school_name', old.name)
      .eq('level', EXTERNAL_LEVEL);
    if (sheetSyncErr) return { error: sheetSyncErr };
  }

  return { error: null };
}

/** 학교를 삭제한다 (하위 프린트/작품명도 CASCADE 삭제) */
export async function deleteSchool(id: string) {
  return supabase.from('schools').delete().eq('id', id);
}
