import { NextResponse } from 'next/server';
import { resolveAppOrigin } from '@/lib/app-origin';

const NAVER_WORKS_AUTH_URL = 'https://auth.worksmobile.com/oauth2/v2.0/authorize';

/**
 * 네이버 웍스 OAuth 인증 페이지로 리다이렉트한다.
 */
export async function GET(request: Request) {
  // redirect_uri 는 Host 헤더가 아니라 신뢰된 APP_ORIGIN 으로 고정한다(콜백과 동일 값).
  // APP_ORIGIN 미설정/오설정(프로덕션)이면 throw 하므로, 제어된 500 으로 매핑한다
  // (origin 을 모르면 우리 도메인으로의 리다이렉트 URL 도 만들 수 없다).
  let origin: string;
  try {
    origin = resolveAppOrigin(request.url);
  } catch {
    // 내부 설정명을 응답 본문에 노출하지 않는다(일반 500).
    return new NextResponse('Internal Server Error', { status: 500 });
  }
  const state = crypto.randomUUID();
  const redirectUri = `${origin}/api/auth/naver-works/callback`;

  const params = new URLSearchParams({
    client_id: process.env.NAVER_WORKS_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'user',
    state,
  });

  const response = NextResponse.redirect(`${NAVER_WORKS_AUTH_URL}?${params}`);

  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
    sameSite: 'lax',
    path: '/',
  });

  return response;
}
