/**
 * 쪽 크게 보기의 이동 규칙 (순수 함수).
 *
 * 다이얼로그가 '이전/다음' 을 스스로 계산하지 않게 떼어 뒀다 — 업로드 화면은 **스캔 전체**
 * (1…N)를 훑고 편집 화면은 **그 묶음이 덮는 쪽만** 훑는데, 뒤쪽은 `[2, 5, 7]` 처럼 띄엄띄엄이라
 * `page ± 1` 이 통하지 않는다. 목록에서의 이웃으로 정의하면 두 화면이 같은 규칙을 쓴다.
 */

/**
 * 1부터 `count` 까지의 쪽 번호.
 * @param count - 전체 쪽 수 (0 이하면 빈 배열)
 * @returns 1-based 쪽 번호 오름차순
 */
export function pageRange(count: number): number[] {
  if (!Number.isFinite(count) || count <= 0) return [];
  return Array.from({ length: Math.floor(count) }, (_, i) => i + 1);
}

/**
 * 목록에서 그 쪽의 앞뒤.
 *
 * 목록에 없는 쪽(닫힌 상태의 `null` 포함)이면 양쪽 다 null 이다 — 없는 자리에서
 * 아무 데로나 뛰지 않는다.
 * @param pages - 훑을 쪽 목록 (보이는 차례 그대로)
 * @param page - 지금 보고 있는 쪽. 닫혀 있으면 null
 * @returns 앞 쪽·뒤 쪽 (없으면 null)
 */
export function neighborPages(
  pages: readonly number[],
  page: number | null,
): { prev: number | null; next: number | null } {
  if (page === null) return { prev: null, next: null };
  const at = pages.indexOf(page);
  if (at === -1) return { prev: null, next: null };
  return {
    prev: at > 0 ? pages[at - 1] : null,
    next: at < pages.length - 1 ? pages[at + 1] : null,
  };
}
