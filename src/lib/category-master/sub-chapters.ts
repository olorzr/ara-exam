import { supabase } from '../supabase';
import type { SubChapter } from '@/types';

/** 소단원 목록을 조회한다 */
export async function getSubChapters(majorChapterId: string): Promise<SubChapter[]> {
  const { data } = await supabase
    .from('sub_chapters').select('*')
    .eq('major_chapter_id', majorChapterId).order('name');
  return (data as SubChapter[]) ?? [];
}

/** 소단원을 추가한다 */
export async function createSubChapter(name: string, majorChapterId: string) {
  return supabase.from('sub_chapters').insert({ name, major_chapter_id: majorChapterId }).select().single();
}

/** 소단원명을 수정하고, 관련 categories의 sub_chapter도 동기화한다 */
export async function updateSubChapter(id: string, name: string) {
  const { data: old, error: selectErr } = await supabase
    .from('sub_chapters')
    .select('name, major_chapter_id, major_chapters(name, grade, semester, publisher_id, publishers(name, level))')
    .eq('id', id)
    .single();
  if (selectErr || !old) {
    return { error: selectErr ?? { message: '소단원을 찾을 수 없습니다.' } };
  }

  const { error: updateErr } = await supabase
    .from('sub_chapters').update({ name }).eq('id', id);
  if (updateErr) return { error: updateErr };

  if (old.name !== name) {
    const mc = old.major_chapters as unknown as {
      name: string; grade: string; semester: string;
      publishers: { name: string; level: string };
    };
    const { error: syncErr } = await supabase
      .from('categories')
      .update({ sub_chapter: name })
      .eq('sub_chapter', old.name)
      .eq('chapter', mc.name)
      .eq('publisher', mc.publishers.name)
      .eq('level', mc.publishers.level)
      .eq('grade', mc.grade)
      .eq('semester', mc.semester);
    if (syncErr) return { error: syncErr };
  }

  return { error: null };
}

/** 소단원을 삭제한다 */
export async function deleteSubChapter(id: string) {
  return supabase.from('sub_chapters').delete().eq('id', id);
}
