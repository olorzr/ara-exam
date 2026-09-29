/**
 * '내가 만든 것 / 다른 선생님이 만든 것' 탭 (순수 함수).
 *
 * 문제지 조합 목록과 학교 프린트 시험지 목록이 같이 쓴다. 가르는 기준은 행의 `user_id`
 * 하나다 — DB 트리거가 `auth.uid()` 로 채우고 UPDATE 에서 잠그므로 믿을 수 있다.
 *
 * ⚠️ **권한을 가르는 장치가 아니다.** RLS 는 그대로 학원 공유라 다른 선생님 것도 열고
 *    지울 수 있다(원장님 결정 2026-09-30). 탭은 보기를 좁힐 뿐이다.
 */

/** 어느 쪽을 보는가 */
export type OwnerScope = 'mine' | 'others';

/** 탭 차례 — 첫 칸이 기본이다 */
export const OWNER_SCOPES: readonly OwnerScope[] = ['mine', 'others'];

/** 탭 이름 */
export const OWNER_SCOPE_LABELS: Record<OwnerScope, string> = {
  mine: '내가 만든 것',
  others: '다른 선생님이 만든 것',
};

/**
 * 탭 값을 읽는다 — base-ui 는 값으로 null 을 줄 수 있다(CLAUDE.md Known Issues).
 * @param value - 탭이 넘긴 값
 * @returns 알아본 값. 모르는 값이면 null
 */
export function parseOwnerScope(value: unknown): OwnerScope | null {
  return OWNER_SCOPES.find((scope) => scope === value) ?? null;
}

/** 조건을 걸 수 있는 요청 — PostgREST 필터 빌더의 필요한 부분만 */
interface OwnerFilterable<T> {
  eq(column: string, value: string): T;
  neq(column: string, value: string): T;
}

/**
 * 만든 사람 조건을 건다 — 서버에서 거른다(받아 온 뒤 거르면 상한에 걸린 목록이 반쪽이 된다).
 * @param request - 필터 빌더
 * @param scope - 내 것 / 다른 선생님 것
 * @param userId - 로그인한 사람의 id
 * @returns 조건을 건 빌더
 */
export function applyOwnerScope<T extends OwnerFilterable<T>>(
  request: T, scope: OwnerScope, userId: string,
): T {
  return scope === 'mine' ? request.eq('user_id', userId) : request.neq('user_id', userId);
}
