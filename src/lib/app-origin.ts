/**
 * OAuth 리다이렉트·콜백에 사용할 앱 origin 을 결정한다.
 *
 * 보안: 라우트 핸들러에서 `new URL(request.url).origin` 으로 origin 을 만들면 그
 * 값이 요청 Host 헤더에서 유래한다. Host 가 조작되면 (1) 토큰 교환의 redirect_uri
 * 가 오염되고, (2) 매직링크 token_hash 를 담은 최종 콜백 URL 이 공격자 호스트로
 * 향할 수 있다(민감 토큰 유출 + 오픈 리다이렉트). 이를 막기 위해 신뢰된
 * 환경변수(APP_ORIGIN)로 origin 을 고정한다.
 *
 * APP_ORIGIN 이 설정돼 있으면 항상 그 값을 정규화해 쓴다(new URL(...).origin 으로
 * 경로·트레일링 슬래시 제거 및 형식 검증). 프로덕션에서 APP_ORIGIN 이 비어 있으면
 * 요청 origin 으로 폴백하지 않고 즉시 throw 한다 — 폴백하면 Host 헤더 기반 계산으로
 * 되돌아가 OAuth origin 고정이 fail-open 이 되기 때문이다(redirect_uri 오염 / 매직링크
 * 토큰 유출 재발). 로컬 개발(NODE_ENV !== 'production')에서만 요청 origin 으로 폴백한다.
 *
 * @param requestUrl 라우트 핸들러의 `request.url`
 * @returns 트레일링 슬래시·경로를 제거한 origin (예: https://voca.example.com)
 * @throws 프로덕션에서 APP_ORIGIN 미설정 시, 또는 APP_ORIGIN 값이 잘못된 URL 일 때
 */
export function resolveAppOrigin(requestUrl: string): string {
  const configured = process.env.APP_ORIGIN?.trim();
  if (configured) {
    // 잘못된 값(스킴 누락 등)은 여기서 throw 되어 fail-closed 된다.
    const url = new URL(configured);
    // http/https 만 허용한다. ftp:·javascript: 등 비정상 스킴이 redirect 에 쓰이는 것을 막는다.
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`APP_ORIGIN 의 스킴은 http/https 여야 합니다(받음: ${url.protocol}).`);
    }
    return url.origin;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'APP_ORIGIN 환경변수가 설정되지 않았습니다. 프로덕션에서는 OAuth origin 고정을 위해 필수입니다.',
    );
  }
  return new URL(requestUrl).origin;
}
