import { ORIENTATION_PAGES_PER_CALL } from './constants';

/**
 * 쪽 번호를 한 번에 물어볼 만큼씩 나눈다 (순수 함수).
 * @param pages - 쪽 번호들 (중복·뒤섞임 허용)
 * @param size - 묶음 크기
 * @returns 오름차순으로 정렬해 나눈 묶음들
 */
export function chunkPages(
  pages: readonly number[],
  size: number = ORIENTATION_PAGES_PER_CALL,
): number[][] {
  const sorted = [...new Set(pages)]
    .filter((p) => Number.isInteger(p) && p >= 1)
    .sort((a, b) => a - b);
  const step = Math.max(1, Math.floor(size));

  const out: number[][] = [];
  for (let i = 0; i < sorted.length; i += step) out.push(sorted.slice(i, i + step));
  return out;
}
