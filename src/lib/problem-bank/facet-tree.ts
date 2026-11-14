import type { FacetTreeNode } from './school-exam-tree';

/**
 * 트리 줄의 글 — 이름 뒤에 건수가 있으면 `이름 (n)`.
 *
 * 화면은 건수를 오른쪽 칸에 따로 찍지만(기출 공유 사이트 트리와 같은 결, 2026-11-14), 화면 읽기
 * 프로그램과 검사는 예전처럼 이 한 줄로 읽는다 — 줄의 `aria-label` 이 이 값이다.
 * @param node - 트리 노드
 * @returns 이름과 건수를 이은 글
 */
export function facetNodeText(node: Pick<FacetTreeNode<unknown>, 'label' | 'count'>): string {
  return node.count === undefined ? node.label : `${node.label} (${node.count})`;
}

/**
 * 찾기 비교용 글 — 자모가 갈린 글자·대소문자·띄어쓰기를 맞춘다('무학 중' 으로도 '무학중' 이 나온다).
 * @param text - 원래 글
 * @returns 비교용 글
 */
export function foldTreeQuery(text: string): string {
  return text.normalize('NFC').toLowerCase().replace(/\s+/g, '');
}

/**
 * 이름으로 트리를 거른다 — 이름이 맞는 노드는 아래까지 통째로, 아니면 맞는 아이가 있는 가지만 남긴다.
 *
 * 기출 공유 사이트 문제 찾기(`features/browse/trees/node.ts` 의 `filterTree`)와 같은 규칙이다.
 * 건수는 보지 않는다(이름만).
 * @param nodes - 트리
 * @param query - 찾는 말(띄어쓰기 무시). 비면 트리 그대로
 * @returns 걸러진 트리
 */
export function filterFacetTree<T>(nodes: readonly FacetTreeNode<T>[], query: string): FacetTreeNode<T>[] {
  const q = foldTreeQuery(query);
  if (!q) return [...nodes];
  const walk = (list: readonly FacetTreeNode<T>[]): FacetTreeNode<T>[] => list.flatMap((node) => {
    if (foldTreeQuery(node.label).includes(q)) return [node];
    const kids = walk(node.children);
    return kids.length > 0 ? [{ ...node, children: kids }] : [];
  });
  return walk(nodes);
}
