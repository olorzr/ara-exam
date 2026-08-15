import { supabase } from '../supabase';
import { EXTERNAL_LEVEL } from '../constants';
import type { SchoolMaterial } from '@/types';

/**
 * 한 학교의 프린트/작품명 목록을 조회한다.
 * 년도/학년으로 좁히지 않고 전부 반환한다 — 학교당 수십 건 규모라 클라이언트에서
 * 거르는 편이 왕복을 줄이고, 같은 목록에서 년도 Select 옵션도 뽑을 수 있다.
 */
export async function getSchoolMaterials(schoolId: string): Promise<SchoolMaterial[]> {
  const { data } = await supabase
    .from('school_materials').select('*')
    .eq('school_id', schoolId).order('name');
  return (data as SchoolMaterial[]) ?? [];
}

/**
 * 프린트/작품명을 추가한다.
 * @param year - 학년도('' 는 미지정)
 * @param grade - 학년('' 는 미지정)
 */
export async function createSchoolMaterial(name: string, schoolId: string, year: string, grade: string) {
  return supabase
    .from('school_materials')
    .insert({ name, school_id: schoolId, year, grade })
    .select().single();
}

/** 프린트/작품명을 수정하고, 관련 categories/concept_sheets 도 동기화한다 */
export async function updateSchoolMaterial(id: string, name: string) {
  const { data: old, error: selectErr } = await supabase
    .from('school_materials')
    .select('name, school_id, year, grade, schools(name)')
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
    // DB 트리거가 있어도 앱 레벨에서도 동기화 시도 (안전장치).
    // year/grade 로 좁히지 않으면 다른 년도·학년의 동명 카테고리까지 함께 바뀐다.
    const { error: syncErr } = await supabase
      .from('categories')
      .update({ chapter: name })
      .eq('chapter', old.name)
      .eq('school_name', school.name)
      .eq('level', EXTERNAL_LEVEL)
      .eq('year', old.year)
      .eq('grade', old.grade);
    if (syncErr) return { error: syncErr };

    // 개념지는 카테고리를 텍스트로 복사 저장하므로 같이 갱신해야 표기가 갈라지지 않는다
    // (categories.chapter ↔ concept_sheets.unit).
    const { error: sheetSyncErr } = await supabase
      .from('concept_sheets')
      .update({ unit: name })
      .eq('unit', old.name)
      .eq('school_name', school.name)
      .eq('level', EXTERNAL_LEVEL)
      .eq('year', old.year)
      .eq('grade', old.grade);
    if (sheetSyncErr) return { error: sheetSyncErr };
  }

  return { error: null };
}

/** 프린트/작품명을 삭제한다 */
export async function deleteSchoolMaterial(id: string) {
  return supabase.from('school_materials').delete().eq('id', id);
}
