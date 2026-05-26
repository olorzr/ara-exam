import { supabase } from '../supabase';
import type { Publisher, MajorChapter, SubChapter, Category } from '@/types';

/**
 * 마스터 테이블(publishers · major_chapters · sub_chapters)에서
 * 모든 중등/고등 카테고리를 Category[] 형태로 조회한다.
 *
 * 단어 등록 여부와 무관하게 가능한 모든 카테고리를 반환하므로,
 * 개념지 에디터처럼 "빈 카테고리도 선택 가능해야 하는" 곳에서 사용한다.
 */
export async function getAllSchoolLevelCategories(): Promise<Category[]> {
  const [pubRes, majorRes, subRes] = await Promise.all([
    supabase.from('publishers').select('*'),
    supabase.from('major_chapters').select('*'),
    supabase.from('sub_chapters').select('*'),
  ]);

  const publishers = (pubRes.data as Publisher[]) ?? [];
  const majors = (majorRes.data as MajorChapter[]) ?? [];
  const subs = (subRes.data as SubChapter[]) ?? [];

  const result: Category[] = [];

  for (const pub of publishers) {
    const pubMajors = majors.filter((m) => m.publisher_id === pub.id);
    for (const major of pubMajors) {
      const majorSubs = subs.filter((s) => s.major_chapter_id === major.id);

      if (majorSubs.length === 0) {
        // 소단원이 없는 대단원도 선택 가능하도록 한 줄짜리 Category 생성
        result.push({
          id: `master-major-${major.id}`,
          level: pub.level,
          grade: major.grade,
          publisher: pub.name,
          semester: major.semester,
          chapter: major.name,
          sub_chapter: '',
          user_id: '',
          created_at: '',
        });
      } else {
        for (const sub of majorSubs) {
          result.push({
            id: `master-sub-${sub.id}`,
            level: pub.level,
            grade: major.grade,
            publisher: pub.name,
            semester: major.semester,
            chapter: major.name,
            sub_chapter: sub.name,
            user_id: '',
            created_at: '',
          });
        }
      }
    }
  }

  return result;
}
