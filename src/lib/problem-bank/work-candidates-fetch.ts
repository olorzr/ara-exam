import { supabase } from '@/lib/supabase';
import type { BundleWorkRow, PassageWorkRow } from './work-candidates';
import type { PassageWork } from '@/types/problem-bank';

/**
 * 작품 후보의 재료를 읽어 온다 (`work-candidates.ts` 의 짝).
 *
 * ⚠️ **fail-soft 다**(교과서 힌트와 같은 규약). 못 읽으면 후보가 없을 뿐, 업로드를 막지 않는다.
 * ⚠️ 학교 하나치라 한 번에 읽는다 — 프린트는 학교당 수십 줄, 기출 지문도 그 정도다.
 */

/** 한 학교에서 읽어 올 최대 줄 수 — 후보 20개를 고르는 데 이보다 더 필요하지 않다 */
const FETCH_LIMIT = 300;

/**
 * 그 학교의 **프린트 시험지 이름**을 읽는다 (선생님이 직접 친 작품명이다).
 *
 * `print_bundles.school_id` 는 `public.schools.id` 와 **같은 값**이다(sql/27 이후
 * `exam.schools` 는 마스터의 거울이고 id 를 맞춰 둔다) — 기출 출처의 `school_id` 로 그대로 찾는다.
 * @param schoolId - public.schools.id
 * @returns 묶음 줄 목록. 못 읽으면 빈 배열
 */
export async function fetchPrintBundleWorks(schoolId: string): Promise<BundleWorkRow[]> {
  if (!schoolId) return [];
  try {
    const { data, error } = await supabase
      .from('print_bundles')
      .select('name, year, grade, semester, exam_type, scan:print_scans!inner(title)')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(FETCH_LIMIT);
    if (error) return [];
    return (data ?? []).map((row) => {
      const r = row as unknown as {
        name: string; year: string; grade: string; semester: string; exam_type: string;
        scan: { title: string } | null;
      };
      return {
        name: r.name ?? '',
        scanTitle: r.scan?.title ?? '',
        year: r.year ?? '',
        grade: r.grade ?? '',
        semester: r.semester ?? '',
        examType: r.exam_type ?? '',
      };
    });
  } catch {
    return [];
  }
}

/**
 * 그 학교 **기출 지문의 작품명·지은이**를 읽는다.
 *
 * ⚠️ **검수를 마친(`완료`) 출처만 본다**(코덱스 리뷰). 모델이 본문으로 알아본 작품명은
 *    저장될 때 이미 `검수중` 이라, 상태를 안 가리면 **아직 아무도 확인하지 않은 추측**이
 *    다음 업로드의 '표준 표기' 힌트가 되어 틀린 이름이 스스로 번진다.
 * @param schoolId - public.schools.id (problem_sources.school_id 스냅샷)
 * @returns 지문 줄 목록. 못 읽으면 빈 배열
 */
export async function fetchSchoolPassageWorks(schoolId: string): Promise<PassageWorkRow[]> {
  if (!schoolId) return [];
  try {
    const { data, error } = await supabase
      .from('passages')
      .select('works, source:problem_sources!inner(school_id, year, grade, semester, exam_type)')
      .eq('source.school_id', schoolId)
      .eq('source.status', '완료')
      .not('works', 'eq', '[]')
      .order('created_at', { ascending: false })
      .limit(FETCH_LIMIT);
    if (error) return [];
    // ⚠️ 지문 하나가 작품을 여럿 들고 있다(sql/33) — **낱개로 펴서** 후보에 넣는다.
    //    파생 문자열(`title`)을 쓰면 '먼 후일 · 독은 아름답다' 가 후보 하나로 실려
    //    모델이 그 이름의 작품이 있는 줄 알고 그대로 베껴 적는다
    return (data ?? []).flatMap((row) => {
      const r = row as unknown as {
        works: PassageWork[] | null;
        source: { year: string; grade: string; semester: string; exam_type: string } | null;
      };
      return (r.works ?? []).map((work) => ({
        title: work.title ?? '',
        author: work.author ?? '',
        year: r.source?.year ?? '',
        grade: r.source?.grade ?? '',
        semester: r.source?.semester ?? '',
        examType: r.source?.exam_type ?? '',
      }));
    });
  } catch {
    return [];
  }
}
