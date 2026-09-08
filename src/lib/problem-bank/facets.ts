import { supabase } from '@/lib/supabase';

/**
 * 아카이브 필터 선택지(패싯) 모으기.
 *
 * ⚠️ **1,000행에서 자르면 안 된다.** PostgREST 기본 상한만 믿으면 업로드가 쌓였을 때
 *    그 뒤에만 있는 학교·학년도·교과서·영역·단원이 **선택지에서 조용히 사라진다**
 *    (문항은 목록에 있는데 고를 수가 없다 — 코덱스 리뷰 6R·15R).
 *    한두 컬럼만 읽으므로 끝까지 훑어도 가볍다.
 */

/** 한 번에 읽는 행 수 (PostgREST 기본 상한) */
const FACET_CHUNK = 1000;

/** 훑을 최대 행 수 — 무한정 훑지 않기 위한 안전판 */
const FACET_MAX_ROWS = 20_000;

/** 출처에서 모은 선택지 */
export interface SourceFacets {
  schools: string[];
  years: string[];
  grades: string[];
  /** 교과서(= exam.publishers.name 스냅샷) */
  textbooks: string[];
}

/**
 * 출처 컬럼에서 실제로 존재하는 값들을 모은다.
 * @returns 학교·학년도·학년·교과서 (빈 값 제외, 정렬됨)
 */
export async function fetchSourceFacets(): Promise<SourceFacets> {
  const rows: { school_name: string; year: string; grade: string; textbook: string }[] = [];
  for (let from = 0; from < FACET_MAX_ROWS; from += FACET_CHUNK) {
    const { data, error } = await supabase
      .from('problem_sources')
      .select('school_name, year, grade, textbook')
      .order('id')
      .range(from, from + FACET_CHUNK - 1);
    if (error) throw error;
    const page = (data ?? []) as typeof rows;
    rows.push(...page);
    if (page.length < FACET_CHUNK) break;
  }

  const uniq = (values: string[]) => [...new Set(values.filter(Boolean))].sort();
  return {
    schools: uniq(rows.map((r) => r.school_name)),
    years: uniq(rows.map((r) => r.year)).reverse(),
    grades: uniq(rows.map((r) => r.grade)),
    textbooks: uniq(rows.map((r) => r.textbook)),
  };
}

/**
 * 이름 경로 배열 컬럼에 실제로 쓰인 경로들 — 필터 선택지를 만든다.
 * @param column - 이름 경로 배열 컬럼 ('area_path' 영역 · 'unit_path' 교과서 단원)
 * @returns 중복 없는 경로 목록 (사전순)
 */
async function collectPathFacets(column: 'area_path' | 'unit_path'): Promise<string[][]> {
  const seen = new Set<string>();
  const out: string[][] = [];

  for (let from = 0; from < FACET_MAX_ROWS; from += FACET_CHUNK) {
    const { data, error } = await supabase
      .from('problems')
      .select(column)
      .not(column, 'eq', '{}')
      .order('id')
      .range(from, from + FACET_CHUNK - 1);
    // 선택지를 못 만들어도 목록은 봐야 한다 — 여기까지 모은 것만 돌려준다
    if (error) break;

    const rows = (data ?? []) as unknown as Record<string, string[]>[];
    for (const row of rows) {
      const path = row[column] ?? [];
      const key = path.join(' > ');
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(path);
    }
    if (rows.length < FACET_CHUNK) break;
  }

  return out.sort((a, b) => a.join('>').localeCompare(b.join('>'), 'ko'));
}

/**
 * 아카이브에 쓰인 영역 경로 목록.
 * @returns 중복 없는 경로 목록
 */
export const fetchAreaFacets = (): Promise<string[][]> => collectPathFacets('area_path');


/**
 * 아카이브에 쓰인 교과서 단원 경로 목록.
 * @returns 중복 없는 경로 목록
 */
export const fetchUnitFacets = (): Promise<string[][]> => collectPathFacets('unit_path');
