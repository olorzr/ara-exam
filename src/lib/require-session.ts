import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { supabaseAdmin } from './supabase-admin';
import { isAllowedEmailDomain } from './constants';
import { extractBearerToken } from './bearer-token';

/**
 * API 라우트의 로그인 검사 — **서버 쪽 권위**.
 *
 * 이 앱은 세션을 localStorage 에 두므로(@supabase/ssr 미사용) 미들웨어가 세션을 못 읽는다.
 * 그래서 클라이언트가 `Authorization: Bearer <access_token>` 을 직접 실어 보내고,
 * 라우트가 service-role 클라이언트로 토큰을 검증한다.
 *
 * 도메인 검사(@araeducation.co.kr)를 여기서도 하는 이유: service-role 은 RLS 를 우회하므로
 * 라우트 안에서는 데이터 계층의 도메인 가드가 걸리지 않는다.
 */

/** 검증 성공이면 user, 실패면 그대로 반환할 응답을 담는다. */
export type SessionResult =
  | { ok: true; user: User }
  | { ok: false; response: NextResponse };

/**
 * 요청의 Bearer 토큰을 검증해 로그인 사용자를 돌려준다.
 * @param request - 들어온 요청 (Authorization 헤더를 읽는다)
 * @returns 성공이면 `{ ok: true, user }`, 실패면 401 응답을 담은 `{ ok: false, response }`
 */
export async function requireSession(request: Request): Promise<SessionResult> {
  const unauthorized = (): SessionResult => ({
    ok: false,
    // 사유를 세분화하지 않는다 — 토큰 유효성 탐색에 힌트를 주지 않기 위해서다.
    response: NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 }),
  });

  const token = extractBearerToken(request.headers.get('authorization'));
  if (!token) return unauthorized();

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user || !isAllowedEmailDomain(data.user.email)) return unauthorized();

  return { ok: true, user: data.user };
}
