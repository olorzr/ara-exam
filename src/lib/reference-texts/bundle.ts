import type { ReferenceTextListItem } from '@/types/reference-text';

/**
 * 묶음 행의 적재 열쇠에 드는 표시 (`평가문제집|<교과서>|<학년-학기>|묶음|…`).
 * ⚠️ 묶기 도구 `~/.claude/tools/regroup-concepts.js` 가 짓는 열쇠와 같아야 한다.
 */
const BUNDLE_KEY_MARK = '|묶음|';

/** 붙은 글의 자리 — 작품 맨 위(제재 정리) / 단원 총괄 오른쪽 칸(여백 글) */
export type ReferenceAttachSlot = 'top' | 'wing';

const WING_KEY_MARK = `${BUNDLE_KEY_MARK}여백|`;

/**
 * 붙은 글을 어디에 그릴까 — 여백 글만 오른쪽 칸이고 나머지(제재 정리 · 모르는 것)는 맨 위다.
 * ⚠️ 열쇠 모양은 묶기 도구(`regroup-concepts.js`)가 짓는 것과 같아야 한다.
 * @param row - 붙은 글
 * @returns 자리
 */
export function referenceAttachSlot(row: Pick<ReferenceTextListItem, 'source_key'>): ReferenceAttachSlot {
  return row.source_key?.includes(WING_KEY_MARK) ? 'wing' : 'top';
}

/**
 * 이 행이 묶음(단원 총괄·제재 정리)인가.
 * @param row - 목록 한 줄
 * @returns 묶기 도구가 지은 행이면 true
 */
export function isReferenceBundle(row: Pick<ReferenceTextListItem, 'source_key'>): boolean {
  return row.source_key?.includes(BUNDLE_KEY_MARK) ?? false;
}

/**
 * 지우기 전에 묻는 말.
 *
 * ⚠️ 묶음을 지우면 DB 가 낱개 행까지 함께 지운다(`ON DELETE CASCADE`, sql/98) — 그 사실을 말하지 않으면
 *    제목 하나를 지운 줄 알고 개념 여러 편을 잃는다.
 * @param row - 지울 줄
 * @returns 확인창 문구
 */
export function referenceDeletePrompt(row: Pick<ReferenceTextListItem, 'title' | 'kind' | 'source_key'>): string {
  if (isReferenceBundle(row)) {
    return `"${row.title}" 묶음을 지울까요?\n안에 든 낱개 개념도 함께 지워지고 되돌릴 수 없습니다.`;
  }
  return row.kind === '개념'
    ? `"${row.title}" 개념 정리를 지울까요?\n되돌릴 수 없습니다.`
    : `"${row.title}" 전문을 지울까요?\n되돌릴 수 없고, 문제 만들기에서 참고자료로 쓸 수 없게 됩니다.`;
}
