/**
 * 목록에서 여러 문항을 골라 지우는 데 쓰는 순수 함수들.
 *
 * ⚠️ **선택은 늘 "지금 보이는 행"과 교집합을 낸다.** 아카이브는 쪽을 나눠 보여 주므로
 *    선택한 채 쪽을 넘기거나 필터를 바꾸면 화면에 없는 id 가 선택 집합에 남는다.
 *    그대로 지우면 **선생님이 보지 못한 문항이 사라진다**(시험지 목록이 같은 이유로
 *    필터가 바뀔 때 선택을 비운다 — useExamHistory 주석 참조).
 */

/** 지운 뒤 어느 쪽을 보여 줄지 계산하는 데 필요한 값 */
export interface PageAfterDeleteInput {
  /** 지금 쪽 (0-based) */
  page: number;
  /** 한 쪽에 보여 주는 행 수 */
  pageSize: number;
  /** 지우기 전 전체 개수 */
  total: number;
  /** 지운 개수 */
  deleted: number;
}

/**
 * 선택 집합에서 **지금 보이는 행만** 골라낸다.
 * @param selected - 선택한 id 들
 * @param visibleIds - 화면에 그려진 행의 id (순서 그대로)
 * @returns 보이는 순서대로의 id 목록
 */
export function visibleSelection(
  selected: ReadonlySet<string>,
  visibleIds: readonly string[],
): string[] {
  return visibleIds.filter((id) => selected.has(id));
}

/**
 * 하나를 넣거나 뺀다. 원본은 건드리지 않는다(React state 규약).
 * @param selected - 지금 선택
 * @param id - 토글할 id
 * @returns 새 선택 집합
 */
export function toggleId(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/**
 * 보이는 행 전체를 켜거나 끈다.
 *
 * 보이는 행이 이미 다 켜져 있으면 비우고, 아니면 보이는 행만 선택한다 —
 * 다른 쪽의 선택은 어차피 `visibleSelection` 이 걸러내므로 여기서 신경 쓰지 않는다.
 * @param selected - 지금 선택
 * @param visibleIds - 화면에 그려진 행의 id
 * @returns 새 선택 집합
 */
export function toggleAllVisible(
  selected: ReadonlySet<string>,
  visibleIds: readonly string[],
): Set<string> {
  if (visibleIds.length === 0) return new Set();
  const allOn = visibleIds.every((id) => selected.has(id));
  return allOn ? new Set() : new Set(visibleIds);
}

/**
 * 지운 뒤 보여 줄 쪽 번호.
 *
 * 마지막 쪽의 문항을 전부 지우면 그 쪽 자체가 사라진다 — 그대로 두면 "조건에 맞는
 * 문항이 없어요" 만 뜨고 선생님은 방금 지운 것이 전부라고 오해한다.
 * @param input - 지금 쪽·쪽 크기·지우기 전 전체 개수·지운 개수
 * @returns 보여 줄 쪽 (0-based)
 */
export function pageAfterDelete(input: PageAfterDeleteInput): number {
  const { page, pageSize, total, deleted } = input;
  const left = Math.max(0, total - deleted);
  const lastPage = Math.max(0, Math.ceil(left / pageSize) - 1);
  return Math.max(0, Math.min(page, lastPage));
}

/**
 * 선택 삭제 확인 문구.
 *
 * 이미 문제지에 담긴 문항이면 개수를 함께 알린다 — 다만 문제지는 **스냅샷**이라
 * 원본이 사라져도 그대로 인쇄된다(sql/17 의 `problem_paper_items.problem_id` 는
 * ON DELETE SET NULL). 그 사실까지 적어야 "인쇄물이 망가지나?" 하고 멈추지 않는다.
 * @param count - 지울 문항 수
 * @param paperCount - 그 문항들이 담긴 문제지 수 (0 이면 알리지 않는다)
 * @returns window.confirm 에 넣을 문구
 */
export function bulkDeleteConfirmMessage(count: number, paperCount: number): string {
  const head = `선택한 ${count}개 문항을 지울까요?`;
  if (paperCount <= 0) return head;
  return `${head}\n이 중 일부는 문제지 ${paperCount}개에 담겨 있어요. 문제지는 스냅샷이라 그대로 인쇄됩니다.`;
}
