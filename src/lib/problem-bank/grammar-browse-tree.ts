import { GRAMMAR_ALL_PATHS, GRAMMAR_TREE, formatGrammarPath } from './grammar-tree';
import type { SelectOption } from '@/components/ui/option-select';
import type { AreaTreeNode } from './area-tree';
import { GRAMMAR_AXIS_CLEARED, type ProblemFilters } from './filters';
import { SCHOOL_AXES_CLEARED, type FacetTreeNode } from './school-exam-tree';
import { WORK_AXIS_CLEARED } from './work-tree';

/**
 * 문법 개념으로 훑는 왼쪽 트리 (순수 함수).
 *
 * ⚠️ **이 트리만 패싯이 아니라 마스터로 만든다.** 다른 세 트리(교과서·학교 기출·작품)는
 *    "문항이 실제로 있는 값만" 보여 주는데, 문법은 일부러 반대로 간다. 까닭이 셋이다:
 *    ① 마스터가 닫혀 있고 유한하다 — `GRAMMAR_TREE` 는 교재 목차대로 고정이라 다 펼쳐도
 *       개수가 안 튄다. 학교·작품은 데이터에서 자라는 축이라 사정이 다르다.
 *    ② 태깅이 **나중에, 손으로** 붙는다. 학교·작품은 업로드와 함께 들어오지만 문법 태그는
 *       이미 저장된 문항에 `add_grammar_paths` 로 붙인다. 패싯만 보여 주면
 *       **태그가 0건 → 선택지 0건 → 붙일 길 없음** 이라는 닭-달걀이 된다(실제로 그랬다).
 *    ③ `(0)` 자체가 정보다. "아직 아무도 피동 표현을 안 붙였다" 는 쓸모 있는 말이지만,
 *       "이 학교 기출이 0건" 은 그냥 없다는 뜻이라 보여 줄 값이 없다.
 *
 * ⚠️ **가지도 고를 수 있어야 한다** — '품사 전체' 가 이 축의 핵심이고 `grammarPathsUnder` 가
 *    그걸 위해 있다. 그런데 `FacetTree` 는 잎만 고를 수 있다. 클릭 규약을 바꾸는 대신
 *    가지마다 **`(전체)` 잎**을 하나 단다 — 교과서 단원 트리가 이미 쓰는 방식이라
 *    선생님이 아는 조작이고, `FacetTree` 는 한 줄도 안 고쳐도 된다.
 */

/** 가지 자신을 고르는 잎의 이름 (교과서 단원 트리와 같은 말) */
export const GRAMMAR_SELF_LEAF = '(전체)';

/**
 * 문법 노드 하나를 가리키는 키.
 *
 * 개념 이름이 가지마다 겹칠 수 있어(`문장 성분` 은 중분류이면서 그 아래 개념이기도 하다)
 * 경로 전체로 키를 만든다. `JSON.stringify` 를 쓰는 것은 다른 두 트리와 같은 규약이다.
 * @param path - 이름 경로
 * @returns 강조·중복 판정에 쓰는 문자열
 */
export function grammarNodeKey(path: string[]): string {
  return `grammar:${JSON.stringify(path)}`;
}

/**
 * 문법 경로를 고를 때의 필터 패치.
 *
 * ⚠️ 다른 트리들과 마찬가지로 **서로의 축을 비운다.** 남겨 두면 '천재 3단원 ∩ 피동 표현' 이
 *    조용히 0건이 되는데 화면에 이유가 없다. 더구나 트리에 붙은 건수는 **전역값**이라,
 *    안 비우면 `(12)` 라고 적힌 가지를 눌렀는데 0건이 나와 **숫자가 거짓말을 한다.**
 *    일부러 겹치고 싶으면 위쪽 필터 줄에서 고른다(다른 세 트리와 같은 규약).
 * @param path - 고른 이름 경로
 * @returns 필터 패치
 */
export function grammarFilterPatch(path: string[]): Partial<ProblemFilters> {
  return {
    ...SCHOOL_AXES_CLEARED,
    ...WORK_AXIS_CLEARED,
    textbook: '',
    unit_path: [],
    grammar_path: path,
    page: 0,
  };
}

/** 건수를 이름 뒤에 붙인다 — 색만으로 알리지 않기 위해 숫자를 늘 적는다 */
function labelWith(name: string, count: number): string {
  return `${name} (${count})`;
}

/**
 * 마스터 노드 하나를 트리 노드로. 가지면 맨 앞에 `(전체)` 잎을 단다.
 * @param node - 마스터 노드
 * @param prefix - 여기까지의 이름 경로
 * @param counts - 경로별 문항 수
 * @returns 트리 노드
 */
function toNode(
  node: AreaTreeNode, prefix: string[], counts: ReadonlyMap<string, number>,
): FacetTreeNode<string[]> {
  const path = [...prefix, node.name];
  const count = counts.get(formatGrammarPath(path)) ?? 0;

  // 잎은 그대로 고를 수 있다
  if (node.children.length === 0) {
    return {
      id: grammarNodeKey(path),
      label: labelWith(node.name, count),
      children: [],
      value: path,
      dimmed: count === 0,
    };
  }

  const selfLeaf: FacetTreeNode<string[]> = {
    id: grammarNodeKey([...path, GRAMMAR_SELF_LEAF]),
    label: labelWith(GRAMMAR_SELF_LEAF, count),
    children: [],
    value: path,
    dimmed: count === 0,
  };

  return {
    id: grammarNodeKey(path),
    label: labelWith(node.name, count),
    // ⚠️ 선언 순서가 곧 화면 순서다 — 정렬하지 말 것(9품사·음운 변동은 학교문법 순서가 있다)
    children: [selfLeaf, ...node.children.map((c) => toNode(c, path, counts))],
    dimmed: count === 0,
  };
}

/**
 * 문법 마스터 전체를 트리로 — 문항이 0건인 개념도 포함한다.
 * @param counts - 경로별 문항 수 (없으면 전부 0건으로 그린다)
 * @returns 대분류부터 시작하는 트리
 */
export function buildGrammarBrowseTree(
  counts: ReadonlyMap<string, number>,
): FacetTreeNode<string[]>[] {
  return GRAMMAR_TREE.map((node) => toNode(node, [], counts));
}

/**
 * 필터 줄의 문법 선택지 — **마스터 전체**다.
 *
 * 건수는 일부러 안 붙인다. 트리거가 좁아(`w-52`) `'문장 > 문법 요소 > 피동 표현'` 만으로도
 * 잘리는데 `(12)` 까지 넣으면 정작 개념 이름이 안 보인다. 건수는 트리가 보여 준다.
 *
 * ⚠️ 이름을 **경로 전체**로 쓴다 — 마디 이름만으로는 모호하다(`'문장 성분'` 은 중분류이면서
 *    그 아래 개념이기도 하다).
 * @returns 목차 순서의 선택지
 */
export function grammarSelectOptions(): SelectOption[] {
  return GRAMMAR_ALL_PATHS.map((path) => ({ value: path, label: path }));
}

export { GRAMMAR_AXIS_CLEARED };
