/** 빈 id 집합 — 새로 만들지 않고 같이 쓴다(읽기 전용) */
export const EMPTY_IDS: ReadonlySet<string> = new Set();

/**
 * id 하나를 넣거나 뺀 새 집합 — 트리의 펼침·접힘 기억(`FacetTree`·`CategoryTree`)이 같이 쓴다.
 * @param prev - 지금 집합
 * @param id - 넣거나 뺄 id
 * @returns 바뀐 새 집합(원래 집합은 그대로)
 */
export function toggled(prev: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(prev);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** 조상 경로 열쇠의 구분자 — 트리 이름·id 에 나오지 않는 제어 문자 */
const PATH_SEP = '\u001f';

/**
 * 조상 경로 열쇠 — 펼침 기억에 쓴다. 노드 id 만으로는 다른 자리의 두 노드가 겹칠 수 있다(카테고리 트리 id 는 이름을 `-` 로 잇는다).
 * @param parentKey - 부모의 경로 열쇠(뿌리면 '')
 * @param id - 이 노드의 id
 * @returns 이 노드의 경로 열쇠
 */
export function treePathKey(parentKey: string, id: string): string {
  return parentKey ? `${parentKey}${PATH_SEP}${id}` : id;
}
