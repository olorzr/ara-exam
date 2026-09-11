'use client';

import { useCallback } from 'react';
import type { useProblemReview } from './useProblemReview';

/**
 * 저장하지 않은 수정을 지키는 **확인 절차**들.
 *
 * 검수 화면의 몇몇 동작은 카드를 다시 마운트시켜 **고치던 내용을 지운다.** 조용히
 * 지우면 선생님은 고친 줄 알고 넘어가고, 검수한 자료인 줄 알고 그대로 인쇄하게 된다
 * (코덱스 리뷰 14R·16R).
 *
 * 셋의 규칙이 서로 다르다:
 *  - **지문 삭제** — 딸린 문항을 다시 읽으므로 다른 카드가 다 날아간다. 지우는 카드
 *    자신은 어차피 없어지므로 셈에서 뺀다.
 *  - **지문 저장** — 작품명을 바꿀 때만, 그리고 **그 지문에 딸린 문항**만 날아간다.
 *    개수를 부풀려 겁주지 않는다.
 *  - **지문 합치기** — 문항이 지문을 옮겨 가고 한 지문이 사라진다. 좁힐 수 없다.
 */
export function useReviewGuards(
  review: ReturnType<typeof useProblemReview>,
  dirtyIds: ReadonlySet<string>,
) {
  const { passages, problems, removePassage, savePassage, mergePassageInto } = review;

  /**
   * 지문을 지운다 — 딸린 문항을 다시 읽으면서 **모든 카드가 다시 마운트된다**.
   * 다른 카드에서 고치던 내용까지 사라지므로 먼저 알린다
   * (지우는 카드 자신은 어차피 없어지므로 셈에서 뺀다 — 코덱스 리뷰 16R).
   */
  const guardedRemove = useCallback((passageId: string) => {
    const others = [...dirtyIds].filter((id) => id !== passageId);
    if (others.length > 0) {
      const ok = window.confirm(
        `다른 카드에 저장하지 않은 수정이 ${others.length}개 있어요.\n`
        + '지문을 지우면 문항을 다시 읽어 오면서 그 수정이 사라집니다. 계속할까요?',
      );
      if (!ok) return;
    }
    removePassage(passageId);
  }, [dirtyIds, removePassage]);

  /**
   * 지문을 저장한다.
   *
   * ⚠️ **작품명을 바꾸면 딸린 문항의 작품명까지 DB 트리거가 함께 바꾼다.** 그러면 그
   *    문항들의 `updated_at` 이 올라가므로 훅이 본문을 다시 읽고 **그 문항 카드만**
   *    다시 마운트한다 — 거기서 고치던 내용은 사라진다. 상관없는 카드는 그대로 둔다.
   */
  const guardedSave = useCallback(async (
    passageId: string,
    patch: Parameters<typeof savePassage>[1],
  ) => {
    const passage = passages.find((p) => p.id === passageId);
    const titleChanged = patch.title !== undefined && passage && patch.title !== passage.title;
    if (titleChanged) {
      // 실제로 영향받는 것은 **이 지문에 딸린 문항**뿐이다 — 개수를 부풀려 겁주지 않는다
      const affected = problems
        .filter((p) => p.passage_id === passageId && dirtyIds.has(p.id));
      if (affected.length > 0) {
        const ok = window.confirm(
          '작품명을 바꾸면 딸린 문항의 작품명도 함께 바뀝니다.\n'
          + `그 문항을 다시 읽어 오므로 저장하지 않은 수정 ${affected.length}개가 사라집니다. 계속할까요?`,
        );
        if (!ok) return false;
      }
    }
    return savePassage(passageId, patch);
  }, [passages, problems, dirtyIds, savePassage]);

  /**
   * 지문 둘을 하나로 — 뒤 지문을 앞 지문에 붙인다.
   *
   * 끝나면 문항이 지문을 옮겨 가고 한 지문이 사라지므로 **모든 카드를 다시 마운트한다.**
   * 어느 카드가 영향받았는지 좁힐 수 없으니(지문 삭제·교과서 변경과 같은 성질) 먼저 묻는다.
   */
  const guardedMerge = useCallback(async (targetId: string, sourceId: string) => {
    const target = passages.find((p) => p.id === targetId);
    const moving = problems.filter((p) => p.passage_id === sourceId).length;
    const lines = [
      `이 지문을 바로 앞 지문(${target?.page_no ?? '?'}쪽)의 뒤에 붙입니다.`,
      moving > 0 ? `딸린 문항 ${moving}개도 앞 지문으로 옮겨집니다.` : '',
      dirtyIds.size > 0 ? `저장하지 않은 수정 ${dirtyIds.size}개가 사라집니다.` : '',
      '되돌릴 수 없어요. 계속할까요?',
    ].filter(Boolean);
    if (!window.confirm(lines.join('\n'))) return;
    await mergePassageInto(targetId, sourceId);
  }, [passages, problems, dirtyIds, mergePassageInto]);

  return { removePassage: guardedRemove, savePassage: guardedSave, mergePassage: guardedMerge };
}
