/**
 * 문항을 **여럿 한꺼번에** 담을 때의 규칙 (순수 함수).
 *
 * 하나씩 담을 때는 없던 문제가 둘 있다:
 *  - 문제지 한 장의 상한(200)을 **넘길 수 있다**. 서버(RPC)가 막지만 그건 저장할 때라,
 *    폴더를 통째로 담고 문항을 늘어놓은 **뒤에야** 거절당한다.
 *  - 이미 담긴 문항이 섞여 있다. 몇 개가 실제로 들어갔는지 말해 주지 않으면
 *    "눌렀는데 아무 일도 안 일어났다" 로 보인다.
 */

/**
 * 문제지 한 장에 담을 수 있는 문항 수.
 *
 * ⚠️ **DB 의 `exam.create_problem_paper` 와 같은 값이어야 한다**(`v_count < 1 OR v_count > 200`).
 *    그 함수의 정식 정의는 마이그레이션을 더할 때마다 **번호가 가장 큰 sql 파일**로 옮겨
 *    가므로 여기에 파일 이름을 적지 않는다 — [bulk-add.test.ts](./bulk-add.test.ts) 가
 *    그 파일을 찾아 읽어 대조한다.
 *    여기서 막는 것은 친절이고 **권위는 서버**다 — 한쪽만 고치면 화면은 담게 해 놓고
 *    저장에서 튕기거나, 담을 수 있는데 막는다.
 */
export const PAPER_MAX_ITEMS = 200;

/**
 * 상한을 넘겨 담을 수 없을 때의 안내 — 담을 수 있으면 null.
 *
 * ⚠️ **일부만 담지 않는다.** 앞에서 N개만 잘라 담으면 지문에 딸린 문항이 중간에서
 *    끊겨 저장할 때 '같은 지문의 문항이 떨어져 있다' 로 다시 막히고, 무엇이 빠졌는지도
 *    화면에 남지 않는다. 담지 않고 **왜 못 담는지와 얼마나 줄여야 하는지**를 말한다.
 * @param current - 지금 담긴 문항 수
 * @param incoming - 새로 담으려는 문항 수
 * @returns 안내 문구. 담을 수 있으면 null
 */
export function bulkAddBlockMessage(current: number, incoming: number): string | null {
  if (current + incoming <= PAPER_MAX_ITEMS) return null;
  const room = Math.max(0, PAPER_MAX_ITEMS - current);
  if (room === 0) {
    return `문제지 한 장은 ${PAPER_MAX_ITEMS}문항까지예요. 이미 가득 찼습니다.`;
  }
  return `문제지 한 장은 ${PAPER_MAX_ITEMS}문항까지예요.`
    + ` 지금 ${current}개를 담았고 새로 ${incoming}개를 담으려고 합니다 —`
    + ` ${room}개까지만 더 담을 수 있어요. 조건을 더 좁혀 주세요.`;
}

/**
 * 폴더 자체가 한 장에 안 들어갈 때의 안내 — 들어가면 null.
 *
 * 담긴 문항 수와 **무관하게** 폴더 크기만 본다. 폴더가 상한을 넘으면 앞에서 잘라 담을
 * 수밖에 없는데, 자르면 지문에 딸린 문항이 중간에서 끊겨 저장할 때 다시 막힌다.
 * @param total - 지금 조건에 걸린 전체 문항 수
 * @returns 안내 문구. 담을 수 있는 크기면 null
 */
export function folderTooBigMessage(total: number): string | null {
  if (total <= PAPER_MAX_ITEMS) return null;
  return `이 폴더는 ${total}문항이라 한 장에 다 담을 수 없어요`
    + ` (문제지 한 장은 ${PAPER_MAX_ITEMS}문항까지).`
    + ' 학년·시험처럼 조건을 더 걸어 좁혀 주세요.';
}

/**
 * 담고 나서 알리는 말.
 * @param added - 실제로 들어간 개수
 * @param skipped - 이미 담겨 있어 건너뛴 개수
 * @returns 토스트 문구
 */
export function bulkAddToast(added: number, skipped: number): string {
  if (added === 0) {
    return skipped > 0 ? '고른 문항이 모두 이미 담겨 있어요.' : '담을 문항이 없어요.';
  }
  return skipped > 0
    ? `${added}문항을 담았어요 (이미 담긴 ${skipped}개는 건너뛰었어요).`
    : `${added}문항을 담았어요.`;
}
