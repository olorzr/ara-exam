'use client'
// 선생님 PC의 codex app-server와 통신하는 클라이언트 (브라우저에서 실행)
//
// 원본: ara-system `app/lib/ai/codex/localClient.ts`.
// 파일당 300줄 규칙에 맞춰 **연결·상태·모델 목록(이 파일)** 과
// **턴 실행(generateDraft.ts)** 으로 나눴다. 프로토콜 규약은 원본 그대로다.
//
// 흐름: connect → initialize → initialized → [account/read | thread/start → turn/start] → 결과
//
// 원칙:
//  - 학원 서버는 이 경로에 관여하지 않는다. auth.json이 선생님 PC를 벗어나지 않는다.
//  - 매 생성마다 **새 ephemeral 스레드**. 학생 A의 스레드를 B에게 재사용하지 않는다.
//  - reasoning·command·file 이벤트는 무시하고 로그로도 남기지 않는다.
//  - 최종 agentMessage만 수집한다.
//
// ⚠️ ephemeral 스레드는 `thread/delete`가 실패한다(실측: "thread is not persisted and
//    cannot be deleted"). 디스크에 쓴 적이 없어서 지울 게 없다는 뜻이므로 정리 호출을 하지 않는다.

import { CodexJsonRpcClient, JsonRpcError } from './jsonRpcClient'
import { WebSocketTransport } from './wsTransport'
import {
  CLIENT_INFO, OPT_OUT_NOTIFICATIONS, looksLikeCodex,
  type CodexModel, type PlanType,
} from './protocol'
import { mapCodexError } from '../errors'
import { AiError } from '../types'
import {
  diagnoseConnectFailure, queryLocalNetworkPermission,
  type NotRunningReason,
} from '../localNetworkAccess'

/** 턴 워치독 기본값. 호출부가 GenerateOptions.timeoutMs 로 개별 상향할 수 있다. */
export const TURN_TIMEOUT_MS = 120_000
const APP_VERSION = '0.1.0'

export type { NotRunningReason }

// not_running에 새 kind를 추가하지 않고 reason을 붙인다 —
// AiConnectionCard의 분기가 exhaustive switch가 아니라 if 체인이라,
// kind를 늘리면 컴파일 에러 없이 연결 실패가 "연결됨"으로 표시될 수 있다.
export type LocalStatus =
  | { kind: 'not_running'; reason: NotRunningReason }
  | { kind: 'not_logged_in' }
  | { kind: 'connected'; planType: PlanType | null; email: string | null }

export function localCodexUrl(port: number): string {
  return `ws://127.0.0.1:${port}`
}

/**
 * 연결 + initialize + initialized. 상대가 codex가 아니면 즉시 끊는다.
 * @param port - 로컬 브릿지 포트
 * @returns 초기화가 끝난 JSON-RPC 클라이언트 (호출부가 close 책임)
 */
export async function handshake(port: number): Promise<CodexJsonRpcClient> {
  let transport: WebSocketTransport
  try {
    transport = await WebSocketTransport.connect(localCodexUrl(port))
  } catch {
    throw new AiError('not_connected')
  }

  const client = new CodexJsonRpcClient(transport, TURN_TIMEOUT_MS)

  let init: unknown
  try {
    init = await client.request('initialize', {
      clientInfo: { ...CLIENT_INFO, version: APP_VERSION },
      capabilities: {
        experimentalApi: false,
        requestAttestation: false,
        optOutNotificationMethods: OPT_OUT_NOTIFICATIONS,
      },
    }, 10_000)
  } catch {
    client.close()
    throw new AiError('not_connected')
  }

  // 같은 포트를 다른 로컬 앱이 쓰고 있을 수 있다.
  // userAgent는 우리가 보낸 이름을 되돌려주므로 판별에 쓸 수 없다 → codexHome/platformOs로 확인.
  if (!looksLikeCodex(init)) {
    client.close()
    throw new AiError('not_connected')
  }

  client.notify('initialized')
  return client
}

/** 연결 상태 조회. 카드 UI가 쓰는 진입점. */
export async function readLocalStatus(port: number): Promise<LocalStatus> {
  let client: CodexJsonRpcClient | null = null
  try {
    client = await handshake(port)
    const acct = await client.request('account/read', {}, 10_000)
    const account = (acct as { account?: unknown } | null)?.account as
      | { type?: string; planType?: PlanType; email?: string }
      | undefined

    // ChatGPT 로그인이 아니면(미로그인 또는 apiKey 모드) 이 기능을 쓸 수 없다.
    // 학원 방침상 API 키 경로는 지원하지 않는다.
    if (!account || account.type !== 'chatgpt') return { kind: 'not_logged_in' }

    return {
      kind: 'connected',
      planType: account.planType ?? null,
      email: account.email ?? null,
    }
  } catch {
    // 실패 원인은 여기서만 한 번 좁힌다. 성공 경로에서는 권한을 조회하지 않는다.
    // 권한을 확신할 수 없으면 reason='unknown' → 기존 안내 문구 그대로다(fail-open).
    const perm = await queryLocalNetworkPermission()
    return { kind: 'not_running', reason: diagnoseConnectFailure(perm) }
  } finally {
    client?.close()
  }
}

export type UsageInfo = { percentUsed: number | null; resetsAt: string | null }

/** 사용량. 형식이 바뀌어도 UI가 안 깨지도록 전부 null 허용. */
export async function readLocalUsage(port: number): Promise<UsageInfo> {
  let client: CodexJsonRpcClient | null = null
  try {
    client = await handshake(port)
    const res = await client.request('account/rateLimits/read', {}, 10_000)
    const limits = (res as { rateLimits?: unknown } | null)?.rateLimits as
      | { primary?: { usedPercent?: number; resetsAt?: string } }
      | undefined
    return {
      percentUsed: typeof limits?.primary?.usedPercent === 'number' ? limits.primary.usedPercent : null,
      resetsAt: typeof limits?.primary?.resetsAt === 'string' ? limits.primary.resetsAt : null,
    }
  } catch {
    return { percentUsed: null, resetsAt: null }
  } finally {
    client?.close()
  }
}

/** model/list 응답 한 항목을 null-safe 매핑. hidden이거나 형태가 이상하면 버린다. */
function mapModel(raw: unknown): CodexModel[] {
  const m = raw as {
    id?: unknown; displayName?: unknown; description?: unknown
    isDefault?: unknown; hidden?: unknown; defaultReasoningEffort?: unknown
    supportedReasoningEfforts?: unknown
  }
  if (typeof m.id !== 'string' || m.id.length === 0) return []
  if (m.hidden === true) return []
  const efforts = Array.isArray(m.supportedReasoningEfforts)
    ? m.supportedReasoningEfforts.flatMap(e => {
        const o = e as { reasoningEffort?: unknown; description?: unknown }
        if (typeof o.reasoningEffort !== 'string' || o.reasoningEffort.length === 0) return []
        return [{
          reasoningEffort: o.reasoningEffort,
          description: typeof o.description === 'string' ? o.description : '',
        }]
      })
    : []
  return [{
    id: m.id,
    displayName: typeof m.displayName === 'string' && m.displayName ? m.displayName : m.id,
    description: typeof m.description === 'string' ? m.description : '',
    isDefault: m.isDefault === true,
    defaultReasoningEffort: typeof m.defaultReasoningEffort === 'string' ? m.defaultReasoningEffort : '',
    supportedReasoningEfforts: efforts,
  }]
}

/** 열린 연결에서 model/list 전체 페이지를 수집한다(nextCursor 페이지네이션). */
export async function fetchModels(client: CodexJsonRpcClient): Promise<CodexModel[]> {
  const models: CodexModel[] = []
  let cursor: string | null = null
  // 페이지 수 상한은 폭주 방어용 — 실측 카탈로그는 1페이지(7개)다.
  for (let page = 0; page < 10; page++) {
    const res = await client.request('model/list', cursor ? { cursor } : {}, 10_000)
    const body = res as { data?: unknown; nextCursor?: unknown } | null
    if (!Array.isArray(body?.data)) break
    models.push(...body.data.flatMap(mapModel))
    cursor = typeof body?.nextCursor === 'string' && body.nextCursor ? body.nextCursor : null
    if (!cursor) break
  }
  return models
}

/**
 * 계정에서 쓸 수 있는 모델 목록.
 * **실패는 null** — 빈 배열(성공했지만 0개)과 구분해야 호출부가 저장된 선택을 잘못 지우지 않는다.
 */
export async function listLocalModels(port: number): Promise<CodexModel[] | null> {
  let client: CodexJsonRpcClient | null = null
  try {
    client = await handshake(port)
    return await fetchModels(client)
  } catch {
    return null
  } finally {
    client?.close()
  }
}

/**
 * 알 수 없는 예외를 사용자에게 보여줄 수 있는 AiError 로 좁힌다.
 * upstream 메시지·스택은 절대 그대로 내보내지 않는다.
 * @param e - 잡은 예외
 * @returns 코드로 좁혀진 AiError
 */
export function toAiError(e: unknown): AiError {
  if (e instanceof AiError) return e
  if (e instanceof JsonRpcError) {
    if (e.codexErrorInfo) return new AiError(mapCodexError(e.codexErrorInfo))
    if (/timeout/i.test(e.message)) return new AiError('timeout')
    return new AiError('provider_unavailable')
  }
  return new AiError('provider_unavailable')
}
