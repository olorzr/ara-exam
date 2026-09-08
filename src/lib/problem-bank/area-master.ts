import { publicDb } from '@/lib/supabase-public';
import { buildAreaTree, type AreaNodeRow, type AreaTreeNode } from './area-tree';

/**
 * 영역 분류 마스터 읽기 (ara-system 소유, **읽기 전용**).
 *
 * 이 표는 ara-system 의 '성적 > 시험 설정 > 영역 분류'가 관리한다. 여기서는 고르기만 하고
 * 저장은 **이름 경로 스냅샷**(`area_path text[]`)으로 한다 — 마스터가 바뀌어도 이미 태깅한
 * 문항이 흔들리면 안 되기 때문이다.
 *
 * ⚠️ **조회 실패는 fail-soft 다.** ara-system 쪽 정책(마이그 474)이 아직 안 깔린 환경에서는
 *    빈 배열이 온다. 그때는 화면이 자유 입력으로 떨어질 뿐 태깅 자체를 막지 않는다.
 */

/** 영역 세트 (학교급별 묶음) */
export interface AreaSet {
  id: string;
  name: string;
  division_id: string | null;
}

/**
 * 쓸 수 있는 영역 세트 목록.
 * @returns 세트 목록. 못 읽으면 빈 배열
 */
export async function fetchAreaSets(): Promise<AreaSet[]> {
  const { data, error } = await publicDb()
    .from('exam_area_sets')
    .select('id, name, division_id, sort_order')
    .eq('is_active', true)
    .order('sort_order');
  if (error) return [];
  return ((data ?? []) as AreaSet[]).map((s) => ({
    id: s.id, name: s.name, division_id: s.division_id,
  }));
}

/**
 * 한 세트의 영역 트리.
 * @param setId - 세트 id
 * @returns 트리. 못 읽으면 빈 배열
 */
export async function fetchAreaTree(setId: string): Promise<AreaTreeNode[]> {
  if (!setId) return [];
  const { data, error } = await publicDb()
    .from('exam_area_nodes')
    .select('id, set_id, parent_id, depth, name, sort_order, is_active')
    .eq('set_id', setId);
  if (error) return [];
  return buildAreaTree((data ?? []) as AreaNodeRow[]);
}

/**
 * 학년으로 어느 세트를 쓸지 짐작한다.
 *
 * 세트는 학교급(division)에 붙어 있는데 ara-exam 은 division id 를 모른다.
 * 그래서 **이름에 '중'·'고'가 들어가는지**로 고르고, 못 고르면 첫 세트를 쓴다.
 * 어차피 선생님이 화면에서 바꿀 수 있으므로 틀려도 손해가 없다.
 * @param sets - 세트 목록
 * @param grade - 학년 ('중2', '고1', '')
 * @returns 고른 세트 id. 세트가 없으면 빈 문자열
 */
export function pickAreaSetForGrade(sets: AreaSet[], grade: string): string {
  if (sets.length === 0) return '';
  const wanted = grade.startsWith('고') ? '고' : grade.startsWith('중') ? '중' : '';
  if (wanted) {
    const hit = sets.find((s) => s.name.includes(wanted));
    if (hit) return hit.id;
  }
  return sets[0].id;
}
