import { supabase } from './supabase';

// 로그인 세션이 필요한 내부 API 호출 공용 래퍼.
//
// 원본: ara-system `app/lib/authFetch.ts`.
// Supabase 액세스 토큰(기본 1시간)이 만료된 채 요청하면 서버가 401을 내는데,
// 폼을 오래 열어두고 저장하는 경우 흔히 발생한다. 아래 두 겹으로 방어:
//   ① 요청 전: 만료 임박(60초 이내)이면 선제 갱신
//   ② 그래도 401이면: 1회 강제 갱신 후 동일 요청 재시도
// 401은 서버가 핸들러 진입 전에 거부한 것이라(아직 아무 변경도 안 일어남) POST 재시도해도 중복 생성 위험이 없다.

async function freshToken(): Promise<string | undefined> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return undefined
  const expMs = (session.expires_at ?? 0) * 1000
  if (expMs && expMs - Date.now() < 60_000) {
    const { data } = await supabase.auth.refreshSession()
    return data.session?.access_token ?? session.access_token
  }
  return session.access_token
}

function withAuth(init: RequestInit, token?: string): RequestInit {
  const headers = new Headers(init.headers)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  if (init.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  return { ...init, headers }
}

/**
 * Authorization 헤더를 붙여 내부 API 를 호출한다(만료 임박 시 선제 갱신 + 401 재시도 1회).
 * @param url - 호출할 경로
 * @param init - fetch 옵션 (body 가 있으면 Content-Type 을 자동으로 채운다)
 * @returns fetch 응답
 */
export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await freshToken()
  const res = await fetch(url, withAuth(init, token))
  if (res.status !== 401) return res

  // 만료 가능 → 1회 강제 갱신 후 재시도. 새 토큰이 없거나 그대로면 그대로 401 반환(→ 명확한 재로그인 안내).
  const { data } = await supabase.auth.refreshSession()
  const retryToken = data.session?.access_token
  if (!retryToken || retryToken === token) return res
  return fetch(url, withAuth(init, retryToken))
}
