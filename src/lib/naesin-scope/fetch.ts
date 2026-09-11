import { publicDb } from '@/lib/supabase-public';
import type { NaesinSchool, PublicTextbook, SchoolScopeRow, ScopeSlotRow } from './types';

/** units 컬럼(jsonb)이 뭐가 와도 string[] 로 정규화한다 */
const normalizeUnits = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.filter((u): u is string => typeof u === 'string') : [];

/**
 * 학교 단위 조회의 행 하나를 `SchoolScopeRow` 로 옮겨 담는다.
 * 키 컬럼의 모양이 틀린 행(학기가 1·2 가 아니거나 시험이 중간·기말이 아닌 것)은 null —
 * 던지지 않는다. 한 행이 이상하다고 그 학교 전체를 못 읽으면 안 된다.
 */
function toSchoolScopeRow(raw: Record<string, unknown>): SchoolScopeRow | null {
  const year = Number(raw.year);
  const semester = Number(raw.semester);
  const examType = raw.exam_type;
  if (typeof raw.grade !== 'string' || !Number.isInteger(year)) return null;
  if (semester !== 1 && semester !== 2) return null;
  if (examType !== '중간' && examType !== '기말') return null;
  return {
    grade: raw.grade,
    year,
    semester,
    exam_type: examType,
    textbook_id: typeof raw.textbook_id === 'string' ? raw.textbook_id : null,
    units: normalizeUnits(raw.units),
    noExam: raw.no_exam === true,
  };
}

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

/**
 * 한 학교의 내신 시험범위 슬롯을 **전부** 가져온다 (학년·학년도·학기·시험 불문).
 *
 * 기출 업로드가 폼 조건에 가장 가까운 슬롯의 교과서를 고르려면 후보가 다 필요하다.
 * 표가 작아(학교 20 × 학년 ≤6 × 몇 해 × 4) 한 번에 읽는 편이 왕복을 아낀다.
 * 유니크 인덱스가 `school_id` 로 시작해 조회도 가볍다.
 * @param schoolId - public.schools.id
 * @returns 정규화된 행 목록. 모양이 틀린 행은 뺀다
 */
export async function fetchSchoolScopeRows(schoolId: string): Promise<SchoolScopeRow[]> {
  const { data, error } = await publicDb()
    .from('school_exam_scopes')
    .select('grade, year, semester, exam_type, textbook_id, units, no_exam')
    .eq('school_id', schoolId);
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  return rows.map(toSchoolScopeRow).filter((r): r is SchoolScopeRow => r !== null);
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
