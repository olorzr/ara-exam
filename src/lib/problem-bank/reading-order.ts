import { toBbox } from './bbox';
import type { Passage } from '@/types/problem-bank';

/**
 * 지문을 **읽는 순서대로** 줄 세운다 (순수 함수).
 *
 * ⚠️ 조회는 `page_no` 다음에 `id` 로 정렬하는데 id 는 **무작위 UUID** 다. 한 쪽에 지문이
 *    둘이면(문제집·프린트에서 흔하다) 화면에 뜨는 차례가 원본과 무관해진다.
 *    그 차례로 '앞 지문에 붙이기' 의 대상을 고르면 **엉뚱한 글에 이어 붙는다** —
 *    되돌릴 수 없는 동작이라 특히 나쁘다(코덱스 리뷰).
 *
 * 기준은 크롭이 쓰는 좌표와 같다: 쪽 → 단(전체 폭 → 왼쪽 → 오른쪽) → 위에서 아래.
 * 좌표가 없는 지문은 맨 뒤로 보낸다(어디인지 모르니 남의 차례를 흔들지 않게).
 */

/** 좌표를 못 읽은 지문의 자리 — 맨 뒤 */
const UNKNOWN = Number.POSITIVE_INFINITY;

/** 이 지문이 쪽 안에서 몇 번째 단인가 (0 = 전체 폭) */
function columnOf(passage: Pick<Passage, 'bbox'>): number {
  const raw = passage.bbox as { column?: unknown } | null;
  if (raw && typeof raw.column === 'number') return raw.column;
  // 옛 행은 정규화 사각형으로 저장돼 있다 — 가로 자리로 단을 가늠한다
  const bbox = toBbox(passage.bbox);
  if (!bbox) return UNKNOWN;
  if (bbox.w > 0.8) return 0;
  return bbox.x < 0.4 ? 1 : 2;
}

/** 이 지문이 쪽에서 얼마나 위인가 (0~1) */
function topOf(passage: Pick<Passage, 'bbox'>): number {
  const bbox = toBbox(passage.bbox);
  return bbox ? bbox.y : UNKNOWN;
}

/**
 * 읽는 순서로 정렬한 새 배열.
 * @param passages - 조회해 온 지문들
 * @returns 쪽 → 단 → 위에서 아래 순서
 */
export function sortByReadingOrder<T extends Pick<Passage, 'page_no' | 'bbox'>>(
  passages: readonly T[],
): T[] {
  return [...passages].sort((a, b) => (
    (a.page_no - b.page_no)
    || (columnOf(a) - columnOf(b))
    || (topOf(a) - topOf(b))
  ));
}
