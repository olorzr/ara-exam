/**
 * 중철 제본 면 배정 (순수 계산).
 *
 * A3 가로 용지 한 면에 A4 두 쪽을 나란히 앉히고, 양면으로 뽑아 반으로 접으면 A4 책자가 된다.
 * 쪽 배정(어느 블록이 몇 쪽인가)은 인쇄 엔진이 이미 끝냈고, 여기서는 **어느 쪽을 어느 장의
 * 어느 면, 왼쪽·오른쪽 어디에 놓는가**만 정한다.
 *
 * 공식(0-based, `total` = 쪽 수를 4의 배수로 올린 값, 장 k):
 *   앞면 [왼쪽, 오른쪽] = [total-1-2k, 2k]
 *   뒷면 [왼쪽, 오른쪽] = [2k+1, total-2-2k]
 * 8쪽이면(1-based) 1장 앞(8,1) 뒤(2,7) · 2장 앞(6,3) 뒤(4,5). 한 면의 두 쪽 합은 늘 total+1 이다.
 *
 * ⚠️ 이 공식은 **'양면 · 짧은 면 뒤집기'** 를 전제한다. A3 가로에서 접는 선은 세로이고
 *    짧은 변이 좌우라, 짧은 면으로 뒤집으면 좌우만 바뀌고 위아래는 그대로다 — 앞면 오른쪽(1쪽)
 *    바로 뒤가 뒷면 왼쪽(2쪽)이 된다. '긴 면' 이면 뒷면이 거꾸로 나온다. 드라이버가 방향을
 *    문서 기준으로 해석해 반대가 맞는 경우가 있어 화면 안내가 그것을 함께 알린다.
 *    **뒤집기 방향이 틀렸다고 공식을 고치지 말 것** — 프린터 설정 문제다.
 *
 * 쪽 수가 4의 배수가 아니면 남는 자리는 **끝에** 빈 면으로 둔다(뒤표지 쪽).
 */

/** A3 한 장(앞·뒤)에 들어가는 A4 쪽 수 */
export const BOOKLET_PAGES_PER_SHEET = 4;

/** 면의 한 자리 — 0-based 쪽 번호, 빈 면이면 null */
export type BookletSlot = number | null;

/** A3 한 장의 앞면·뒷면 배치 (각각 [왼쪽, 오른쪽]) */
export interface BookletSheet {
  front: [BookletSlot, BookletSlot];
  back: [BookletSlot, BookletSlot];
}

/**
 * 쪽 수를 담는 데 필요한 A3 장 수.
 * @param pageCount - A4 쪽 수
 * @returns 장 수 (0쪽이면 0)
 */
export function bookletSheetCount(pageCount: number): number {
  if (!Number.isFinite(pageCount) || pageCount <= 0) return 0;
  return Math.ceil(Math.floor(pageCount) / BOOKLET_PAGES_PER_SHEET);
}

/**
 * 중철 책자의 장별 면 배치.
 * @param pageCount - A4 쪽 수 (읽는 순서)
 * @returns 장마다 앞면·뒷면의 [왼쪽, 오른쪽] 쪽 번호(0-based, 빈 면은 null)
 */
export function bookletSheets(pageCount: number): BookletSheet[] {
  const sheets = bookletSheetCount(pageCount);
  const count = sheets === 0 ? 0 : Math.floor(pageCount);
  const total = sheets * BOOKLET_PAGES_PER_SHEET;
  const slot = (page: number): BookletSlot => (page < count ? page : null);

  return Array.from({ length: sheets }, (_, k) => ({
    front: [slot(total - 1 - 2 * k), slot(2 * k)],
    back: [slot(2 * k + 1), slot(total - 2 - 2 * k)],
  }));
}
