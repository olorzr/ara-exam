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
