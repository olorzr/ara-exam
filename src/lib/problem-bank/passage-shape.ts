import type { PassagePatch } from './mutations';
import { joinWorkTitles, normalizePassageWorks } from './work-title';
import type { Passage, PassageWork } from '@/types/problem-bank';

/**
 * 지문 저장이 **딸린 문항 행까지 움직이는가** (순수 함수).
 *
 * DB 트리거 둘이 지문 쪽 값을 문항 행에 옮긴다 — 작품명 목록(`passages_sync_work_titles`, sql/33)과
 * 대영역(`passages_sync_area`, sql/67). 옮기면 그 문항의 `updated_at` 이 올라, 화면이 옛 버전을
 * 들고 있으면 다음 저장이 **아무도 안 고쳤는데 충돌로 튕긴다.** 그래서 검수 화면은 이 판정이 참일 때
 * 딸린 문항을 다시 읽는다(`useProblemReview.savePassage`).
 *
 * ⚠️ 트리거가 **실제로 움직일 때만** 참이어야 한다. 넓게 잡으면 멀쩡한 문항 카드를 다시 마운트해
 *    저장하지 않은 발문이 사라진다(코덱스 리뷰).
 */

/**
 * 작품명 목록이 달라졌는가.
 *
 * ⚠️ 지은이·구분 표시까지 견주면 안 된다 — 전파 트리거는 제목 목록이 같으면 문항을 **한 행도**
 *    건드리지 않는다. 보낼 값은 다듬어진 뒤 저장되므로 여기서도 다듬어 견준다(`(가)` → `가`).
 * @param next - 보낼 작품 목록
 * @param prev - 화면이 들고 있던 작품 목록
 * @returns 제목 목록이 다르면 true
 */
export function workTitlesDiffer(next: readonly PassageWork[], prev: readonly PassageWork[]): boolean {
  const titles = (works: readonly PassageWork[]) =>
    joinWorkTitles(normalizePassageWorks(works).map((w) => w.title));
  return titles(next) !== titles(prev);
}

/**
 * 대영역(`area_path` 첫 칸)이 달라졌는가 — 소영역만 바뀌면 트리거가 움직이지 않는다.
 * ⚠️ 지문 편집기는 전체 저장마다 `area_path` 를 싣는다 — 실려 왔는지가 아니라 **값으로** 견준다.
 * @param next - 보낼 영역 경로 (안 보내면 undefined)
 * @param prev - 화면이 들고 있던 영역 경로
 * @returns 대영역이 다르면 true
 */
export function areaTopDiffers(next: readonly string[] | undefined, prev: readonly string[]): boolean {
  if (next === undefined) return false;
  return (next[0] ?? '') !== (prev[0] ?? '');
}

/**
 * 이 저장이 딸린 문항 행을 움직이는가.
 * @param patch - 보낼 값
 * @param target - 화면이 들고 있던 지문
 * @returns 작품명 목록이나 대영역이 바뀌면 true
 */
export function passageShapeChanged(patch: PassagePatch, target: Passage): boolean {
  const titles = patch.works !== undefined && workTitlesDiffer(patch.works, target.works ?? []);
  return titles || areaTopDiffers(patch.area_path, target.area_path ?? []);
}
