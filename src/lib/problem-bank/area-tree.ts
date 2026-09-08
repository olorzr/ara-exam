/**
 * 영역 분류 트리 (순수 함수).
 *
 * 마스터는 ara-system 이 소유한다(`public.exam_area_sets` / `exam_area_nodes`, 최대 4단).
 * ⚠️ **마스터는 선택지일 뿐 태깅의 정본이 아니다.** 문항에는 노드 id 가 아니라
 *    **이름 경로 스냅샷**(`area_path text[]`)을 저장한다 — 마스터에서 이름을 바꾸거나
 *    노드를 지워도 이미 태깅한 문항과 인쇄한 문제지는 그대로여야 하기 때문이다.
 *
 * 원본: ara-system `app/lib/examAreaSets.ts` 의 순수 부분.
 */

/** 마스터 노드 원본 행 */
export interface AreaNodeRow {
  id: string;
  set_id: string;
  parent_id: string | null;
  depth: number;
  name: string;
  sort_order: number;
  is_active: boolean;
}

/** 트리 노드. children 은 마지막 단계에서 빈 배열 */
export interface AreaTreeNode {
  id: string;
  name: string;
  children: AreaTreeNode[];
}

/** 만들 수 있는 최대 단계 수 (ara-system mig339 의 depth CHECK 와 같은 값) */
export const AREA_DEPTH_MAX = 4;

/** 단계 라벨 — 화면의 열 제목·안내 문구가 공유하는 단일 출처 */
export const AREA_DEPTH_LABELS = ['대영역', '영역', '상세', '세부'] as const;

/**
 * 평평한 노드 목록을 트리로 만든다.
 * @param rows - 마스터 노드 행 (한 세트분)
 * @returns 정렬된 최상위 노드 목록
 */
export function buildAreaTree(rows: AreaNodeRow[]): AreaTreeNode[] {
  const byId = new Map<string, AreaTreeNode>();
  for (const row of rows) {
    if (!row.is_active) continue;
    byId.set(row.id, { id: row.id, name: row.name, children: [] });
  }

  const roots: AreaTreeNode[] = [];
  // sort_order → 이름 순. DB order 만으로는 '10단원'이 '2단원'보다 앞에 온다
  const ordered = rows
    .filter((r) => r.is_active)
    .slice()
    .sort((a, b) => (a.sort_order !== b.sort_order
      ? a.sort_order - b.sort_order
      : a.name.localeCompare(b.name, 'ko')));

  for (const row of ordered) {
    const node = byId.get(row.id);
    if (!node) continue;
    // 부모가 비활성이면 그 가지는 통째로 버린다(고아 노드를 최상위로 올리지 않는다)
    if (row.parent_id === null) roots.push(node);
    else byId.get(row.parent_id)?.children.push(node);
  }

  return roots;
}

/**
 * 이름 경로가 트리에 실재하는지 검사한다.
 * 빈 이름을 만나면 거기서 끝난 것으로 보고 통과시킨다(상위만 지정한 경우).
 * @param tree - 영역 트리
 * @param path - 이름 경로 (['문학', '현대시'])
 * @returns 트리에 있는 경로면 true
 */
export function isKnownPath(tree: AreaTreeNode[], path: string[]): boolean {
  if (!path[0]) return false;
  let nodes = tree;
  for (const name of path) {
    if (!name) return true;
    const hit = nodes.find((n) => n.name === name);
    if (!hit) return false;
    nodes = hit.children;
  }
  return true;
}

/**
 * 트리에 있는 만큼만 남기고 자른다.
 *
 * 통째로 버리지 않는 이유: 모델이 '문학 > 현대시 > 심상' 처럼 마지막 단계만 지어냈을 때
 * '문학 > 현대시' 는 멀쩡한 정보다. 버리면 사람이 처음부터 다시 골라야 한다.
 * @param tree - 영역 트리 (비어 있으면 검증을 건너뛰고 원본을 그대로 돌려준다)
 * @param path - 검사할 이름 경로
 * @returns 트리에 있는 최장 접두사
 */
export function longestKnownPrefix(tree: AreaTreeNode[], path: string[]): string[] {
  if (tree.length === 0) return path.slice(0, AREA_DEPTH_MAX);

  const out: string[] = [];
  let nodes = tree;
  for (const name of path) {
    const hit = nodes.find((n) => n.name === name);
    if (!hit) break;
    out.push(hit.name);
    nodes = hit.children;
  }
  return out;
}

/**
 * 특정 경로 아래에서 고를 수 있는 이름들.
 * @param tree - 영역 트리
 * @param path - 지금까지 고른 경로 (빈 배열이면 최상위)
 * @returns 다음 단계 이름 목록 (경로가 트리에 없으면 빈 배열)
 */
export function optionsAt(tree: AreaTreeNode[], path: string[]): string[] {
  let nodes = tree;
  for (const name of path) {
    if (!name) break;
    const hit = nodes.find((n) => n.name === name);
    if (!hit) return [];
    nodes = hit.children;
  }
  return nodes.map((n) => n.name);
}

/**
 * 영역 경로를 한 줄로 보여 준다.
 * @param path - 이름 경로
 * @returns '문학 > 현대시' (빈 경로면 빈 문자열)
 */
export function areaPathLabel(path: string[]): string {
  return path.filter(Boolean).join(' > ');
}
