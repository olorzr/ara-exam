'use client'
// 브라우저의 Local Network Access(LNA) 권한 조회 (브라우저 전용)
//
// 왜 필요한가:
//   Chrome 142(2025-10)부터 공개 origin이 loopback·사설IP에 접근하는 것을 권한 프롬프트로 게이팅한다.
//   fetch/XHR에 먼저 적용됐고 WebSocket 확장이 진행 중이다(about://flags 의
//   local-network-access-check-websockets / Finch LocalNetworkAccessChecksWebSockets).
//   우리는 https 관리자센터에서 ws://127.0.0.1 로 붙으므로 이 게이트에 걸릴 수 있다.
//
//   ※ mixed content는 문제가 아니다 — 127.0.0.1은 potentially trustworthy라
//     https 페이지에서도 ws:// 가 차단되지 않는다. (`localhost` 호스트명은 별개 취급이라
//     localClient.ts 가 IP 리터럴을 쓰는 것이 맞다.)
//
// 원칙: **fail-open**. 권한을 확신할 수 없으면 항상 'unknown'을 돌려주고
//   호출부는 기존 안내 문구로 떨어진다. 이 모듈은 게이트가 아니라 안내 품질 개선이다.
//   Firefox·Safari·구버전 Chrome은 이 permission name을 몰라 전부 'unknown'이 된다.

/** Permissions API 상태. 'unknown' = 조회 불가 → **판단하지 않는다**. */
export type LnaPermission = 'granted' | 'prompt' | 'denied' | 'unknown'

/** 연결 실패 원인 추정. UI 문구 분기에만 쓴다. */
export type NotRunningReason = 'unknown' | 'browser_blocked' | 'browser_prompt'

const PERMISSION_NAME = 'local-network-access'
const QUERY_TIMEOUT_MS = 1_000

// lib.dom 의 PermissionName 유니온에 'local-network-access'가 아직 없어
// navigator.permissions.query를 그대로 쓰면 컴파일이 막힌다 → unknown 경유 + 타입가드.
type PermissionsLike = { query: (desc: { name: string }) => Promise<unknown> }

function hasQuery(v: unknown): v is PermissionsLike {
  if (typeof v !== 'object' || v === null) return false
  return typeof (v as { query?: unknown }).query === 'function'
}

function readState(v: unknown): LnaPermission {
  const state = (v as { state?: unknown } | null | undefined)?.state
  if (state === 'granted' || state === 'prompt' || state === 'denied') return state
  return 'unknown'
}

/**
 * navigator.permissions 를 안전하게 읽는다.
 * 확장·하드닝 브라우저가 throwing getter를 걸어둘 수 있어 접근 자체를 감싼다.
 */
function defaultPermissions(): unknown {
  try {
    if (typeof navigator === 'undefined') return undefined
    return navigator.permissions
  } catch {
    return undefined
  }
}

/**
 * LNA 권한 상태 조회. **절대 throw하지 않고, 절대 매달리지 않는다.**
 *
 * 이 함수가 reject하면 호출부인 readLocalStatus의 catch 안에서 터져
 * 상태 확인 전체가 깨지므로, 던질 수 있는 모든 것을 try 안에 둔다.
 *
 * @param perms 테스트 주입용. 생략하면 navigator.permissions (SSR이면 undefined).
 */
export async function queryLocalNetworkPermission(
  perms: unknown = defaultPermissions(),
): Promise<LnaPermission> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    // 타입가드도 try 안이다 — Proxy의 .query 접근이 던질 수 있다.
    if (!hasQuery(perms)) return 'unknown'

    // 이 permission name을 모르는 엔진은 **동기 throw 와 reject 를 둘 다** 한다.
    // try/catch 한 블록으로 감싸야 둘 다 잡힌다 (.catch() 체인만 쓰면 동기 throw를 놓친다).
    const result = await Promise.race([
      perms.query({ name: PERMISSION_NAME }),
      // 조회가 안 끝나서 상태 확인이 영원히 안 끝나는 새 실패 모드를 만들지 않는다.
      new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), QUERY_TIMEOUT_MS) }),
    ])
    return readState(result)
  } catch {
    return 'unknown'
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * 연결 실패의 원인을 권한 상태로 좁힌다.
 *
 * ⚠️ 'prompt'를 "프롬프트를 놓쳤다"로 단정하면 안 된다 —
 *   한 번도 물어본 적 없는 origin의 기본 상태가 'prompt'라,
 *   codex가 그냥 꺼져 있는 압도적 다수의 경우도 'prompt'로 나온다.
 *   그래서 **'denied'일 때만 문구를 대체**하고, 'prompt'는 보조 안내만 덧붙인다.
 */
export function diagnoseConnectFailure(perm: LnaPermission): NotRunningReason {
  if (perm === 'denied') return 'browser_blocked'
  if (perm === 'prompt') return 'browser_prompt'
  return 'unknown'
}
