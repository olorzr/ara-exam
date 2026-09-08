'use client'
// 코덱스 턴 실행 — 프롬프트(+이미지) → 구조화 JSON 문자열
//
// localClient.ts 에서 갈라져 나온 파일이다(파일당 300줄 규칙). 연결·상태 조회는 그쪽에 있다.
//
// ⚠️ ephemeral 스레드는 `thread/delete` 가 실패한다(실측: "thread is not persisted and
//    cannot be deleted"). 디스크에 쓴 적이 없어서 지울 게 없다는 뜻이므로 정리 호출을 하지 않는다.

import { CodexJsonRpcClient } from './jsonRpcClient'
import { LOCKED_SANDBOX, MAX_TURN_IMAGES, extractFinalAnswer, type UserInput } from './protocol'
import { handshake, fetchModels, toAiError, TURN_TIMEOUT_MS } from './localClient'
import { mapCodexError } from '../errors'
import { AiError } from '../types'

/**
 * 생성 직전 오버라이드 재검증 — 저장된 값이 단종·미지원이면 **보내지 않는다**(기본값으로 생성).
 * 잘못된 model id는 turn/start가 일단 수락한 뒤 비동기 error로 터지므로(실측),
 * 사전에 거르는 것이 유일한 방어다. effort는 명시적으로 고른 모델이 지원할 때만 보낸다 —
 * 모델 미선택 시 실제 기본 모델(codex 설정값일 수 있음)의 지원 목록을 알 수 없다.
 */
async function sanitizeOverride(
  client: CodexJsonRpcClient,
  model: string | null,
  effort: string | null,
): Promise<{ model: string | null; effort: string | null }> {
  if (!model && !effort) return { model: null, effort: null }
  const list = await fetchModels(client).catch(() => null)
  if (!list) return { model: null, effort: null }
  const target = model ? list.find(m => m.id === model) : undefined
  if (model && !target) return { model: null, effort: null }
  const effortOk = !!effort && !!target
    && target.supportedReasoningEfforts.some(o => o.reasoningEffort === effort)
  return { model: target?.id ?? null, effort: effortOk ? effort : null }
}

export type GenerateOptions = {
  port: number
  prompt: string
  outputSchema: unknown
  /** 모델 오버라이드(model/list의 id). null/미지정 = 계정 기본 모델. */
  model?: string | null
  /** 추론 노력 오버라이드. null/미지정 = 모델 기본값. */
  effort?: string | null
  /** 첨부 이미지 data URL(시험지 등). 상한은 호출부가 관리하되 여기서도 방어적으로 자른다. */
  images?: string[]
  /** 취소용. abort 되면 turn/interrupt 후 연결을 닫는다. */
  signal?: AbortSignal
  /**
   * 이 턴의 워치독(ms). 미지정이면 TURN_TIMEOUT_MS.
   *
   * 전역 상수를 올리는 대신 호출부가 개별 지정하게 한 이유: 지연을 지배하는 건 이미지 장수가
   * 아니라 **출력 토큰 수**다. 해설 500자 × 30문항 같은 요청만 예산을 늘려야 하고,
   * 전역을 올리면 다른 기능들의 '죽은 연결 포기 시간'까지 같이 늘어난다.
   */
  timeoutMs?: number
}

/**
 * 초안 생성. 반환값은 **검증 전 원문 JSON 문자열**이다.
 * 스키마 검증은 호출부에서 schemas.ts로 한다(파싱 실패와 스키마 불일치를 구분하기 위해).
 */
export async function generateDraft(opts: GenerateOptions): Promise<string> {
  const { port, prompt, outputSchema, model, effort, images, signal, timeoutMs } = opts
  let client: CodexJsonRpcClient | null = null

  try {
    client = await handshake(port)

    // 매 생성마다 새 ephemeral 스레드 — 학생 간 컨텍스트가 절대 섞이지 않게.
    const started = await client.request('thread/start', {
      ephemeral: true,
      sandbox: 'read-only',
      approvalPolicy: 'never',
    }, 15_000)

    const threadId = (started as { thread?: { id?: string } } | null)?.thread?.id
    if (!threadId) throw new AiError('provider_unavailable')

    // 저장된 모델·노력이 지금도 유효한지 같은 연결에서 확인하고, 아니면 버린다.
    const override = await sanitizeOverride(client, model ?? null, effort ?? null)

    // 재검증을 기다리는 사이 취소됐으면 turn을 시작하지 않는다 —
    // runTurn의 abort 리스너는 지난 abort 이벤트를 재생하지 않는다.
    if (signal?.aborted) throw new AiError('cancelled')

    const finalText = await runTurn(
      client, threadId, prompt, outputSchema, override, images, signal, timeoutMs,
    )
    return finalText
  } catch (e) {
    throw toAiError(e)
  } finally {
    // ephemeral 스레드는 디스크에 없으므로 thread/delete를 호출하지 않는다.
    // 연결을 닫으면 서버 쪽 상태도 함께 정리된다.
    client?.close()
  }
}

function runTurn(
  client: CodexJsonRpcClient,
  threadId: string,
  prompt: string,
  outputSchema: unknown,
  override: { model?: string | null; effort?: string | null },
  images?: string[],
  signal?: AbortSignal,
  timeoutMs?: number,
): Promise<string> {
  const budget = Number.isFinite(timeoutMs) && (timeoutMs as number) > 0
    ? (timeoutMs as number)
    : TURN_TIMEOUT_MS
  return new Promise<string>((resolve, reject) => {
    let finalText: string | null = null
    let settled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    // ⚠️ 실측: turn/interrupt는 turnId가 **필수**다 — {threadId}만 보내면
    // "missing field `turnId`"로 거부된다. turn/start 응답(즉시 옴)에서 받아 둔다.
    let turnId: string | null = null
    const interrupt = () => {
      // turnId를 아직 못 받았으면 호출 생략 — 어차피 연결을 닫으면 서버가 정리한다.
      if (!turnId) return
      client.request('turn/interrupt', { threadId, turnId }, 5_000).catch(() => { /* 정리 실패는 무시 */ })
    }

    // 한 번만 정착시키고 타이머·리스너를 반드시 정리한다.
    const settle = (ok: boolean, value: string | AiError) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      if (ok) resolve(value as string)
      else reject(value as AiError)
    }
    const done = (text: string) => settle(true, text)
    const fail = (err: AiError) => settle(false, err)

    function onAbort() {
      // 취소 시 진행 중인 turn을 정리한다.
      interrupt()
      fail(new AiError('cancelled'))
    }

    client.onNotification((method, params) => {
      // reasoning·command·file 이벤트는 여기서 걸러진다. 저장도 전달도 하지 않는다.
      if (method === 'item/completed') {
        const text = extractFinalAnswer(params)
        if (text) finalText = text
        return
      }
      if (method === 'turn/completed') {
        const turn = (params as { turn?: { status?: string; error?: unknown } } | null)?.turn
        if (turn?.status === 'completed' && finalText) {
          done(finalText)
        } else {
          const info = (turn?.error as { codexErrorInfo?: unknown } | undefined)?.codexErrorInfo
          fail(new AiError(info ? mapCodexError(info) : 'invalid_output'))
        }
        return
      }
      if (method === 'error') {
        const info = (params as { codexErrorInfo?: unknown } | null)?.codexErrorInfo
        fail(new AiError(mapCodexError(info)))
      }
    })

    signal?.addEventListener('abort', onAbort, { once: true })

    timer = setTimeout(() => {
      interrupt()
      fail(new AiError('timeout'))
    }, budget)

    // 텍스트(서버 작성 프롬프트) 뒤에 첨부 이미지(시험지 data URL)를 붙인다.
    const input: UserInput[] = [
      { type: 'text', text: prompt, text_elements: [] },
      ...(images ?? []).slice(0, MAX_TURN_IMAGES).map(url => ({ type: 'image' as const, url })),
    ]

    client.request('turn/start', {
      threadId,
      input,
      outputSchema,
      // 스레드 설정에 더해 턴 단위로도 잠근다(방어 이중화).
      sandboxPolicy: LOCKED_SANDBOX,
      approvalPolicy: 'never',
      // 선생님이 고른 모델·노력. 미선택이면 필드 자체를 보내지 않는다(계정 기본값 사용).
      ...(override.model ? { model: override.model } : {}),
      ...(override.effort ? { effort: override.effort } : {}),
    }, budget)
      .then(res => { turnId = (res as { turn?: { id?: string } } | null)?.turn?.id ?? null })
      .catch(e => fail(toAiError(e)))
  })
}
