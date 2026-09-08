import { supabase } from '@/lib/supabase';
import type { Passage, Problem, ProblemSource } from '@/types/problem-bank';

/**
 * 문항 **한 개를 지문과 함께** 읽는 조회들 (상세 창·작품별 묶음).
 *
 * 목록 조회(`queries.ts`)는 본문 HTML 이 무거워 컬럼을 좁히고 지문을 조인하지 않는다.
 * 하나를 자세히 볼 때만 여기서 넓게 읽는다.
 */

/** 문항 하나를 지문과 함께 본 것 */
export interface ProblemDetail {
  problem: Problem;
  source: ProblemSource;
  /** 딸린 지문. 없으면 null */
  passage: Passage | null;
  /** 같은 지문에 딸린 문항들(자기 자신 포함, 번호순). 지문이 없으면 자기 하나뿐 */
  siblings: Problem[];
}

/**
 * 문항 하나를 **지문·형제 문항까지** 한 번에 읽는다 (상세 창).
 *
 * 형제를 본문째 받아 오는 이유: 상세 창에서 '이 지문의 문항' 을 눌러 옮겨 다니는데,
 * 그때마다 다시 조회하면 지문이 깜빡이고 왕복이 는다. 한 지문의 문항은 많아야 대여섯이다.
 * @param id - 문항 id
 * @returns 문항·출처·지문·형제. 문항이 없으면 null
 */
export async function fetchProblemDetail(id: string): Promise<ProblemDetail | null> {
  const { data, error } = await supabase
    .from('problems')
    .select('*, source:problem_sources!inner(*), passage:passages(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as Problem & { source: ProblemSource; passage: Passage | null };
  const { source, passage, ...problem } = row;

  const siblings = passage
    ? await fetchProblemsOfPassage(passage.id)
    : [problem as Problem];

  return { problem: problem as Problem, source, passage, siblings };
}

/**
 * 한 지문에 딸린 문항 전부 (번호순).
 * @param passageId - 지문 id
 * @returns 문항 목록
 */
export async function fetchProblemsOfPassage(passageId: string): Promise<Problem[]> {
  const { data, error } = await supabase
    .from('problems')
    .select('*')
    .eq('passage_id', passageId)
    .order('number', { nullsFirst: false })
    .order('id');
  if (error) throw error;
  return (data ?? []) as Problem[];
}

/**
 * 지문 여러 건을 id 로 읽는다 (작품별 보기의 묶음 머리).
 * @param ids - 지문 id 들
 * @returns 지문 목록 (없는 id 는 빠진다)
 */
export async function fetchPassagesByIds(ids: string[]): Promise<Passage[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];
  const { data, error } = await supabase
    .from('passages')
    .select('*')
    .in('id', unique);
  if (error) throw error;
  return (data ?? []) as Passage[];
}
