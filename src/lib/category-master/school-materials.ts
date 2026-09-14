import { supabase } from '../supabase';
import { normalizeCategoryName } from '../category-name';
import type { SchoolMaterial } from '@/types';

/**
 * 프린트/작품명 마스터(`school_materials`) — **조회와 생성뿐이다.**
 *
 * 프린트를 만드는 곳은 `학교 프린트 시험지` 업로드 한 곳이고(`print-scan/save.ts` 의
 * `ensureSchoolMaterial`), 앱에는 이름을 고치거나 지우는 화면이 없다(2026-09-14).
 * 손으로 적는 길을 함께 두었더니 같은 프린트가 두 표기로 갈라져 트리가 쪼개졌다.
 *
 * ⚠️ 그래서 이름 변경 전파의 정본은 **DB 트리거 `exam.sync_school_material_name`**(sql/26) 뿐이다.
 *    앱 레벨 fallback(`categories.chapter`·`concept_sheets.unit` 동기화)은 그 트리거를
 *    발화시킬 앱 경로가 사라졌으므로 함께 지웠다. 이름을 고치거나 지울 일이 생기면 SQL 로 한다.
 */

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
    .insert({ name: normalizeCategoryName(name), school_id: schoolId, year, grade })
    .select().single();
}
