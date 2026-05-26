import { supabase } from '../supabase';
import type { MajorChapter } from '@/types';

/** 대단원 목록을 조회한다 (출판사 + 학년 + 학기 필터) */
export async function getMajorChapters(publisherId: string, grade?: string, semester?: string): Promise<MajorChapter[]> {
  let query = supabase.from('major_chapters').select('*').eq('publisher_id', publisherId).order('name');
  if (grade) query = query.eq('grade', grade);
  if (semester) query = query.eq('semester', semester);
  const { data } = await query;
  return (data as MajorChapter[]) ?? [];
}

/** 대단원을 추가한다 */
export async function createMajorChapter(name: string, publisherId: string, grade: string, semester: string) {
  return supabase.from('major_chapters').insert({ name, publisher_id: publisherId, grade, semester }).select().single();
}

/** 대단원명을 수정하고, 관련 categories의 chapter도 동기화한다 */
export async function updateMajorChapter(id: string, name: string) {
  const { data: old, error: selectErr } = await supabase
    .from('major_chapters')
    .select('name, grade, semester, publisher_id, publishers(name, level)')
    .eq('id', id)
    .single();
  if (selectErr || !old) {
    return { error: selectErr ?? { message: '대단원을 찾을 수 없습니다.' } };
  }

  const { error: updateErr } = await supabase
    .from('major_chapters').update({ name }).eq('id', id);
  if (updateErr) return { error: updateErr };

  if (old.name !== name) {
    const pub = old.publishers as unknown as { name: string; level: string };
    const { error: syncErr } = await supabase
      .from('categories')
      .update({ chapter: name })
      .eq('chapter', old.name)
      .eq('publisher', pub.name)
      .eq('level', pub.level)
      .eq('grade', old.grade)
      .eq('semester', old.semester);
    if (syncErr) return { error: syncErr };
  }

  return { error: null };
}

/** 대단원을 삭제한다 (하위 소단원도 CASCADE 삭제) */
export async function deleteMajorChapter(id: string) {
  return supabase.from('major_chapters').delete().eq('id', id);
}
