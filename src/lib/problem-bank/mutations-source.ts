import { supabase } from '@/lib/supabase';
import { normalizeCategoryName } from '@/lib/category-name';
import { normalizeGrammarPaths } from './grammar-tree';

/**
 * **출처 단위**·**일괄** 쓰기 — 한 행이 아니라 출처 하나나 문항 여러 개를 한꺼번에 건드린다.
 *
 * 문항·지문 한 행을 고치는 쪽(`mutations.ts`)과 갈라 둔 이유는 규약이 달라서다:
 * 저기는 `updated_at` 을 걸어 **낙관적 동시성**을 지키지만, 여기 것들은 여러 행을
 * 한 번에 바꾸므로 그 조건을 걸 수 없고 대신 **DB 함수(RPC) 한 번**으로 보낸다.
 */

/**
 * 출처를 지운다. 지문·문항이 CASCADE 로 함께 사라진다.
 *
 * ⚠️ 이미 만든 문제지는 **스냅샷**이라 계속 인쇄된다(항목의 problem_id 만 null 이 된다).
 *
 * ⚠️ Storage 는 건드리지 않는다 — `deleteProblems` 와 같은 까닭이다(mutations.ts).
 *
 * ⚠️ **지운 행을 돌려받아 확인한다.** PostgREST 의 DELETE 는 한 행도 못 지워도
 *    `error` 가 null 이라, 그냥 두면 "지웠다" 와 "아무것도 안 했다" 가 구분되지 않는다.
 *    화면은 성공 토스트를 띄우는데 목록에는 그대로 남는 — 바로 이 기능이 없던 시절의
 *    제보("삭제가 아예 안 된다")와 똑같은 모양이 된다.
 * @param id - 출처 id
 * @throws 삭제 실패 시, 또는 지운 행이 없을 때(이미 지워졌거나 정책이 막았을 때)
 */
export async function deleteSource(id: string): Promise<void> {
  const { data, error } = await supabase
    .from('problem_sources')
    .delete()
    .eq('id', id)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('이미 지워졌거나 지울 수 없는 출처예요.');
}

/**
 * 출처 상태를 바꾼다(검수중 → 완료).
 * @param id - 출처 id
 * @param status - 새 상태
 * @throws 저장 실패 시
 */
export async function setSourceStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase.from('problem_sources').update({ status }).eq('id', id);
  if (error) throw error;
}

/**
 * 출처의 교과서를 바꾼다 — 이미 붙은 단원 태그도 같은 트랜잭션에서 정리한다.
 *
 * 업로드 때 못 골랐거나 잘못 고른 것을 검수에서 고칠 수 있어야 한다 — 교과서가 없으면
 * 단원 칸 자체가 안 뜨므로, 이 경로가 없으면 옛 출처는 **영영 분류할 수 없다**
 * (코덱스 리뷰 1R).
 *
 * ⚠️ **RPC 한 번으로 보낸다.** 문항·지문·출처를 UPDATE 세 번으로 나누면 중간에 하나가
 *    실패했을 때 "태그만 사라지고 교과서는 그대로" 가 되어 손으로 붙인 분류를 잃는다
 *    (코덱스 리뷰 3R). DB 함수가 한 트랜잭션으로 처리한다.
 * @param id - 출처 id
 * @param textbook - 교과서 이름 ('' 는 미지정)
 * @param clearUnits - 이미 붙은 단원 태그를 함께 지울지
 * @returns 저장된 이름
 */
export async function setSourceTextbook(
  id: string,
  textbook: string,
  clearUnits: boolean,
): Promise<string> {
  const { data, error } = await supabase.rpc('set_source_textbook', {
    p_source_id: id,
    p_textbook: normalizeCategoryName(textbook),
    p_clear_units: clearUnits,
  });
  if (error) throw error;
  return (data as string) ?? '';
}

/**
 * 문항 여러 개에 문법 분류를 **덧붙인다** (아카이브의 일괄 태깅).
 *
 * ⚠️ **RPC 한 번으로 보낸다.** PostgREST 로는 배열 append 를 못 해서 행마다
 *    읽고-합치고-쓰면 한 쪽에 60왕복이고, 그 사이 다른 사람이 붙인 태그를 덮어쓴다.
 *
 * 합집합이라 기존 태그를 지우지 않는다 — 그래서 낙관적 동시성 조건이 없다.
 * 이미 상한(5개)까지 찬 문항에는 아무것도 붙지 않는다(기존 것을 밀어내지 않는다).
 * @param problemIds - 문항 id 들
 * @param paths - 붙일 경로 문자열들
 * @returns 실제로 바뀐 문항 수
 * @throws 저장 실패 시
 */
export async function addGrammarPaths(problemIds: string[], paths: string[]): Promise<number> {
  const ids = [...new Set(problemIds)];
  const values = normalizeGrammarPaths(paths);
  if (ids.length === 0 || values.length === 0) return 0;

  const { data, error } = await supabase.rpc('add_grammar_paths', {
    p_problem_ids: ids,
    p_paths: values,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}

/**
 * 이 출처에서 단원이 붙어 있는 문항·지문 수를 센다.
 * @param sourceId - 출처 id
 * @returns 태깅된 행 수
 */
export async function countTaggedUnits(sourceId: string): Promise<number> {
  const counts = await Promise.all(['problems', 'passages'].map(async (table) => {
    const { count, error } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('source_id', sourceId)
      .not('unit_path', 'eq', '{}');
    if (error) throw error;
    return count ?? 0;
  }));
  return counts[0] + counts[1];
}
