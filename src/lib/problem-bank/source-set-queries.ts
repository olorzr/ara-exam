import { supabase } from '@/lib/supabase';
import { fetchSources, SOURCE_PAGE_SIZE, type SourceListRow } from './source-list';
import { MOCK_EXAM_SOURCE_TYPE } from './school-exam-tree';
import { setSourceQuery } from './source-set-link';
import { compareSourceSets, orderSetSources, toSourceSets, type SourceSet, type SourceSetKey } from './source-sets';
import { parseSourceSets } from './source-sets-payload';

/**
 * 기출 세트 조회.
 *
 * 세트 목록은 `exam.source_sets()`(sql/107) **한 번**이다 — 출처 표만 묶어 jsonb 하나로 준다(문항 표를 안 읽는다).
 * 세트 한 장은 '올라간 기출' 목록과 같은 `fetchSources`(문항 수 계산 열 sql/74)로 그 세트 출처만 읽는다.
 */

/** 한 번에 받을 쪽 수 — `fetchSources` 가 PostgREST 1,000행 상한 아래로 깎는다 */
const ALL_PAGES = Number.MAX_SAFE_INTEGER;

/** 이어 읽기 안전판 — 한 세트가 이만큼(× 990행) 넘을 일은 없다 */
const MAX_ROUNDS = 20;

/**
 * 세트 목록.
 * @returns 정렬된 세트들 (내신 먼저, 최근 학년도부터)
 * @throws 조회 실패 시
 */
export async function fetchSourceSets(): Promise<SourceSet[]> {
  const { data, error } = await supabase.rpc('source_sets');
  if (error) throw error;
  return toSourceSets(parseSourceSets(data)).sort(compareSourceSets);
}

/**
 * 세트 한 장에 든 출처 전부 — 문항 수(`problem_count`)와 함께.
 *
 * ⚠️ 말없이 자르지 않는다 — 990행을 넘으면 이어 읽는다(가장 큰 세트는 82곳이지만 늘어난다).
 * @param set - 세트 칸
 * @returns 학교(모의고사는 과목) 차례의 출처들
 * @throws 조회 실패 시
 */
export async function fetchSetSources(set: SourceSetKey): Promise<SourceListRow[]> {
  const query = setSourceQuery(set);
  const rows: SourceListRow[] = [];
  let total = Infinity;
  for (let round = 0; round < MAX_ROUNDS && rows.length < total; round += 1) {
    // 받은 행이 쪽 크기의 배수일 때만 이어 받는다 — 덜 왔으면 그게 끝이다
    if (rows.length % SOURCE_PAGE_SIZE !== 0) break;
    const page = await fetchSources({ query, page: rows.length / SOURCE_PAGE_SIZE, pageCount: ALL_PAGES });
    total = page.total;
    if (page.rows.length === 0) break;
    rows.push(...page.rows);
  }
  const inSet = set.source_type === MOCK_EXAM_SOURCE_TYPE
    ? rows.filter((row) => (row.publisher ?? '') === set.publisher)
    : rows;
  return orderSetSources(inSet);
}
