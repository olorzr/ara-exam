import { supabase } from '../supabase';
import { normalizeCategoryName } from '../category-name';
import type { Publisher } from '@/types';

/** 출판사 목록을 조회한다 */
export async function getPublishers(level?: string): Promise<Publisher[]> {
  let query = supabase.from('publishers').select('*').order('name');
  if (level) query = query.eq('level', level);
  const { data } = await query;
  return (data as Publisher[]) ?? [];
}

/** 출판사를 추가한다 (이름은 표준 표기로 정규화해 저장한다) */
export async function createPublisher(name: string, level: string) {
  return supabase
    .from('publishers')
    .insert({ name: normalizeCategoryName(name), level })
    .select().single();
}

/** 출판사명을 수정하고, 관련 categories/concept_sheets 의 publisher 도 동기화한다 */
export async function updatePublisher(id: string, rawName: string) {
  // 표기 변형(공백·전각 괄호 등)을 그대로 저장하면 트리에서 같은 이름이 두 폴더로 갈라진다
  const name = normalizeCategoryName(rawName);

  const { data: old, error: selectErr } = await supabase
    .from('publishers').select('name, level').eq('id', id).single();
  if (selectErr || !old) {
    return { error: selectErr ?? { message: '출판사를 찾을 수 없습니다.' } };
  }

  const { error: updateErr } = await supabase
    .from('publishers').update({ name }).eq('id', id);
  if (updateErr) return { error: updateErr };

  // DB 트리거가 있어도 앱 레벨에서도 동기화 시도 (안전장치).
  // 개념지(concept_sheets)도 반드시 함께 갱신해야 한다 — categories 만 고치면
  // 트리거가 없는 환경에서 단어지는 새 이름, 개념지는 옛 이름으로 갈라진다.
  if (old.name !== name) {
    const { error: syncErr } = await supabase
      .from('categories')
      .update({ publisher: name })
      .eq('publisher', old.name)
      .eq('level', old.level);
    if (syncErr) return { error: syncErr };

    const { error: sheetSyncErr } = await supabase
      .from('concept_sheets')
      .update({ publisher: name })
      .eq('publisher', old.name)
      .eq('level', old.level);
    if (sheetSyncErr) return { error: sheetSyncErr };
  }

  return { error: null };
}

/** 출판사를 삭제한다 (하위 대단원/소단원도 CASCADE 삭제) */
export async function deletePublisher(id: string) {
  return supabase.from('publishers').delete().eq('id', id);
}
