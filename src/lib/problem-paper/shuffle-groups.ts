import { shuffle } from '@/lib/shuffle';
import { groupsOf, type PaperItem } from './compose';

/**
 * 지문 묶음 단위로 순서를 섞는다 (순수 함수 + 주입식 난수).
 *
 * ⚠️ 문항 하나씩 섞으면 **같은 지문의 문항이 흩어진다** — 인쇄에서 지문이 여러 번
 *    반복되고 머리글 범위가 거짓말을 한다. 그래서 묶음을 단위로 섞고 묶음 **안의 순서는
 *    그대로 둔다**(보통 원본 시험지의 출제 순서라 난이도 흐름이 있다).
 *
 * `Math.random() - 0.5` 정렬을 쓰지 않는다 — 비교 함수가 비일관적이라 분포가 치우친다.
 * `src/lib/shuffle.ts` 의 Fisher-Yates 를 쓴다.
 */

/**
 * 캔버스를 지문 묶음 단위로 섞는다.
 * @param items - 캔버스 항목
 * @param shuffleFn - 섞기 함수 (테스트에서 갈아 끼운다)
 * @returns 새 캔버스. 묶음 안 순서는 유지된다
 */
export function shuffleGroups(
  items: readonly PaperItem[],
  shuffleFn: <T>(arr: readonly T[]) => T[] = shuffle,
): PaperItem[] {
  const blocks = groupsOf(items).map((g) => items.slice(g.start, g.end + 1));
  return shuffleFn(blocks).flat();
}
