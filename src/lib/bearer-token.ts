/**
 * Authorization 헤더에서 Bearer 토큰만 뽑아내는 순수 함수.
 *
 * 라우트 인증(require-session.ts)에서 갈라낸 이유는 테스트 때문이다 —
 * 이 저장소의 테스트는 Supabase 를 목으로 만들지 않으므로, 검증할 가치가 있는 파싱 규칙만
 * 순수 함수로 떼어 고정한다.
 */

const BEARER_PREFIX = 'Bearer ';

/**
 * `Authorization: Bearer <token>` 에서 토큰을 꺼낸다.
 * 스킴은 대소문자를 가리지 않고(RFC 7235), 앞뒤 공백은 무시한다.
 * @param header - Authorization 헤더 원문 (없으면 null/undefined 허용)
 * @returns 토큰 문자열. 형식이 아니거나 토큰이 비어 있으면 빈 문자열
 */
export function extractBearerToken(header: string | null | undefined): string {
  if (!header) return '';
  const trimmed = header.trim();
  if (trimmed.length <= BEARER_PREFIX.length) return '';
  if (trimmed.slice(0, BEARER_PREFIX.length).toLowerCase() !== BEARER_PREFIX.toLowerCase()) {
    return '';
  }
  return trimmed.slice(BEARER_PREFIX.length).trim();
}
