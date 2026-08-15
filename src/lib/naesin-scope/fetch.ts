import { publicDb } from '@/lib/supabase-public';
import type { NaesinSchool, PublicTextbook, ScopeSlotRow } from './types';

/** units 컬럼(jsonb)이 뭐가 와도 string[] 로 정규화한다 */
const normalizeUnits = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.filter((u): u is string => typeof u === 'string') : [];

/**
 * ara-system 에 등록된 학교 목록을 가져온다.
 * @param level '중등' | '고등' (한글 — ara-system schools.level 규약)
 */
export async function fetchNaesinSchools(level: string): Promise<NaesinSchool[]> {
  const { data, error } = await publicDb()
    .from('schools')
    .select('id, name, level')
    .eq('level', level)
    .order('name');
  if (error) throw error;
  return (data as NaesinSchool[]) ?? [];
}

/**
 * (학교 × 학년 × 학년도 × 학기 × 중간/기말) 내신 시험범위 슬롯 단건을 가져온다.
 * 저장된 행이 없으면 null.
 */
export async function fetchScopeSlot(
  schoolId: string,
  grade: string,
  year: number,
  semester: 1 | 2,
  examType: '중간' | '기말',
): Promise<ScopeSlotRow | null> {
  const { data, error } = await publicDb()
    .from('school_exam_scopes')
    .select('scope, teacher_name, textbook_id, units, exam_start_date, exam_end_date, korean_exam_date, no_exam')
    .eq('school_id', schoolId)
    .eq('grade', grade)
    .eq('year', year)
    .eq('semester', semester)
    .eq('exam_type', examType)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  // no_exam(ara-system mig379) 은 스네이크 → 카멜로 옮겨 담는다. 값이 없는 옛 행은 false.
  const { no_exam: noExam, ...rest } = data as Record<string, unknown>;
  return { ...rest, units: normalizeUnits(data.units), noExam: noExam === true } as ScopeSlotRow;
}

/** 교과서 단건 (출판사·학년 — 카테고리 매칭 키). 없으면 null */
export async function fetchPublicTextbook(id: string): Promise<PublicTextbook | null> {
  const { data, error } = await publicDb()
    .from('curriculum_textbooks')
    .select('id, school_level, grade, publisher, book_title')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as PublicTextbook) ?? null;
}
