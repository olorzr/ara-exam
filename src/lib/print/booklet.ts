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
 * 쪽 수가 4의 배수가 아니면 남는 자리는 **끝에** 빈 면으로 둔다.
 *
 * 뒷표지가 있으면(`backCover`) 마지막 쪽(뒷표지)은 늘 **책의 맨 뒤 자리**(`total-1` — 1장 앞면 왼쪽)에 놓고,
 * 빈 면은 그 **앞**(본문 끝과 뒷표지 사이, `count-1 .. total-2`)에 둔다. 자리 공식은 그대로라 짝 합 불변식도
 * 그대로다 — 바뀌는 것은 `total-1` 자리에 앉는 쪽뿐이다.
 *
 * 앞표지가 있고(`frontCover`) 빈 면이 하나라도 생기면 **첫 빈 면은 표지 바로 뒤**(자리 1 — 1장 뒷면 왼쪽,
 * 앞표지 안쪽)에 두고 본문은 한 자리씩 뒤로 민다(2026-11-07 원장 요청 "빈 장수가 나오면 꼭 표지 다음 쪽 하나를
 * 비워 달라" — 책 관례). 나머지 빈 면은 그대로 끝(뒷표지 앞)이다. 빈 면이 없거나 앞표지가 없으면 바뀌는 것이
 * 없다. 이것도 자리 공식은 건드리지 않고 자리에 앉는 쪽만 바꾼다.
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
 * 쪽 수를 4의 배수로 올리느라 생기는 빈 면 수.
 * @param pageCount - A4 쪽 수 (앞표지·뒷표지가 있으면 그것까지)
 * @returns 빈 면 수 (0쪽·이상한 값이면 0)
 */
export function bookletBlankCount(pageCount: number): number {
  const sheets = bookletSheetCount(pageCount);
  return sheets === 0 ? 0 : sheets * BOOKLET_PAGES_PER_SHEET - Math.floor(pageCount);
}

/** 면 배치 선택 */
export interface BookletOptions {
  /** 첫 쪽이 앞표지다 — 빈 면이 생기면 그 하나를 표지 바로 뒤(표지 안쪽)에 둔다 */
  frontCover?: boolean;
  /** 마지막 쪽이 뒷표지다 — 책의 맨 뒤 자리에 놓고 빈 면은 그 앞에 둔다 */
  backCover?: boolean;
}

/**
 * 중철 책자의 장별 면 배치.
 * @param pageCount - A4 쪽 수 (읽는 순서, 앞표지·뒷표지가 있으면 그것까지)
 * @param options - 앞표지·뒷표지가 있는가
 * @returns 장마다 앞면·뒷면의 [왼쪽, 오른쪽] 쪽 번호(0-based, 빈 면은 null)
 */
export function bookletSheets(pageCount: number, options: BookletOptions = {}): BookletSheet[] {
  const sheets = bookletSheetCount(pageCount);
  const count = sheets === 0 ? 0 : Math.floor(pageCount);
  const total = sheets * BOOKLET_PAGES_PER_SHEET;
  const back = Boolean(options.backCover) && count > 0;
  const bodyCount = back ? count - 1 : count;
  // 빈 면이 있을 때만 앞표지 안쪽을 비운다 — 4의 배수면 끼울 자리가 없다
  const insideCoverBlank = Boolean(options.frontCover) && count > 0 && total > count;
  const slot = (position: number): BookletSlot => {
    if (back && position === total - 1) return count - 1;
    if (insideCoverBlank && position === 1) return null;
    const page = insideCoverBlank && position > 1 ? position - 1 : position;
    return page < bodyCount ? page : null;
  };

  return Array.from({ length: sheets }, (_, k) => ({
    front: [slot(total - 1 - 2 * k), slot(2 * k)],
    back: [slot(2 * k + 1), slot(total - 2 - 2 * k)],
  }));
}
