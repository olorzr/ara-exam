import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isAllowedEmailDomain } from '@/lib/constants';
import { resolveAppOrigin } from '@/lib/app-origin';

const TOKEN_URL = 'https://auth.worksmobile.com/oauth2/v2.0/token';
const USER_API_URL = 'https://www.worksapis.com/v1.0/users/me';

/** unknown 값이 객체인지 좁히는 타입 가드 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** 외부 응답에서 문자열 프로퍼티를 안전하게 읽는다(없거나 문자열이 아니면 undefined) */
function readString(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) return undefined;
  const field = value[key];
  return typeof field === 'string' ? field : undefined;
}

/**
 * 네이버 웍스 OAuth 콜백. 인증 코드를 토큰으로 교환하고 사용자를 검증한다.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  // origin 은 Host 헤더가 아니라 신뢰된 APP_ORIGIN 으로 고정한다. Host 조작으로
  // redirect_uri 가 오염되거나 매직링크 token_hash 가 공격자 호스트로 새는 것을 막는다.
  // APP_ORIGIN 미설정/오설정(프로덕션)이면 throw 하므로 제어된 500 으로 매핑한다
  // (origin 을 모르면 로그인 페이지로의 리다이렉트 URL 도 만들 수 없다).
  let origin: string;
  try {
    origin = resolveAppOrigin(request.url);
  } catch {
    // 내부 설정명을 응답 본문에 노출하지 않는다(일반 500).
    return new NextResponse('Internal Server Error', { status: 500 });
  }
  const loginUrl = `${origin}/login`;

  const cookieStore = await cookies();
  const savedState = cookieStore.get('oauth_state')?.value;

  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(`${loginUrl}?error=invalid_request`);
  }

  cookieStore.delete('oauth_state');

  // 외부 fetch/Supabase 호출은 네트워크 오류·JSON 파싱 실패 등으로 throw 될 수
  // 있다. try/catch 가 없으면 예외가 라우트 밖으로 새어 500 이 반환되므로,
  // 모든 예기치 못한 실패를 안정적인 에러 리다이렉트로 매핑한다.
  try {
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: process.env.NAVER_WORKS_CLIENT_ID!,
        client_secret: process.env.NAVER_WORKS_CLIENT_SECRET!,
        redirect_uri: `${origin}/api/auth/naver-works/callback`,
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(`${loginUrl}?error=token_failed`);
    }

    const tokenData: unknown = await tokenRes.json();
    const accessToken = readString(tokenData, 'access_token');

    if (!accessToken) {
      return NextResponse.redirect(`${loginUrl}?error=token_failed`);
    }

    const userRes = await fetch(USER_API_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userRes.ok) {
      return NextResponse.redirect(`${loginUrl}?error=user_info_failed`);
    }

    const userData: unknown = await userRes.json();
    const email = readString(userData, 'email') ?? readString(userData, 'userId');

    if (!isAllowedEmailDomain(email)) {
      return NextResponse.redirect(`${loginUrl}?error=unauthorized_domain`);
    }

    // provider 는 app_metadata 에 기록한다. user_metadata 와 달리 app_metadata 는
    // service-role(admin)만 쓸 수 있어 클라이언트가 위조할 수 없는 권위 있는 출처
    // 표식이 된다. (단, 다른 provider 우회를 막는 1차 방어선은 Supabase 대시보드에서
    // 불필요한 인증 provider 를 비활성화하는 것 + RLS 의 도메인 제한이다.)
    const { error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      app_metadata: { provider: 'naver-works' },
    });

    if (createError && !createError.message.includes('already been registered')) {
      return NextResponse.redirect(`${loginUrl}?error=create_user_failed`);
    }

    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email,
      });

    if (linkError || !linkData?.properties?.hashed_token) {
      return NextResponse.redirect(`${loginUrl}?error=session_failed`);
    }

    const tokenHash = linkData.properties.hashed_token;
    const callbackUrl = `${origin}/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=magiclink`;

    return NextResponse.redirect(callbackUrl);
  } catch {
    return NextResponse.redirect(`${loginUrl}?error=server_error`);
  }
}
