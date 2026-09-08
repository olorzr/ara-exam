// Codex App Server용 JSON-RPC(JSONL) 클라이언트
//
// 전송 계층을 **주입받는다**. child process에 직접 묶지 않은 이유:
//  1) 현재 배포 환경(Vercel 서버리스)에서는 child process를 띄울 수 없다
//  2) 테스트에서 실제 프로세스 없이 in-memory duplex로 전 구간을 돌릴 수 있다
//
// stdout은 JSON-RPC 전용이고 stderr는 로그다. 둘을 절대 섞지 않는다.
// raw 메시지 전체를 운영 로그에 남기지 않는다 — 인증정보와 학생 데이터가 들어있다.

import type { CodexErrorInfo } from './protocol'

export type JsonRpcId = number | string

type PendingEntry = {
  resolve: (v: unknown) => void
  reject: (e: Error) => void
  timer: ReturnType<typeof setTimeout> | null
}

/** 최소 전송 인터페이스 — Node stream이든 테스트용 fake든 이것만 만족하면 된다. */
export interface JsonRpcTransport {
  /** 한 줄(JSONL) 전송. 개행은 구현체가 붙인다. */
  send(line: string): void
  /** 수신 줄마다 호출될 콜백 등록. */
  onLine(handler: (line: string) => void): void
  /** 연결 종료(정상/비정상). 이유 문자열을 전달. */
  onClose(handler: (reason: string) => void): void
  close(): void
}

export class JsonRpcError extends Error {
  constructor(message: string, readonly codexErrorInfo: CodexErrorInfo | null = null) {
    super(message)
    this.name = 'JsonRpcError'
  }
}

export type NotificationHandler = (method: string, params: unknown) => void

export class CodexJsonRpcClient {
  private nextId = 1
  private pending = new Map<JsonRpcId, PendingEntry>()
  private notificationHandlers: NotificationHandler[] = []
  private closed = false
  private closeReason = ''

  constructor(
    private readonly transport: JsonRpcTransport,
    private readonly defaultTimeoutMs = 120_000,
  ) {
    transport.onLine(line => this.handleLine(line))
    transport.onClose(reason => this.handleClose(reason))
  }

  onNotification(handler: NotificationHandler): void {
    this.notificationHandlers.push(handler)
  }

  /** 요청 전송 후 응답 대기. 타임아웃이면 pending을 정리하고 실패시킨다. */
  request(method: string, params?: unknown, timeoutMs?: number): Promise<unknown> {
    if (this.closed) {
      return Promise.reject(new JsonRpcError(`connection closed: ${this.closeReason}`))
    }
    const id = this.nextId++
    const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params })

    return new Promise<unknown>((resolve, reject) => {
      const ms = timeoutMs ?? this.defaultTimeoutMs
      const timer = ms > 0
        ? setTimeout(() => {
            this.pending.delete(id)
            reject(new JsonRpcError(`timeout: ${method}`))
          }, ms)
        : null

      this.pending.set(id, { resolve, reject, timer })
      try {
        this.transport.send(payload)
      } catch {
        // 전송 실패 원문은 남기지 않는다 — 페이로드에 학생 데이터가 들어있다.
        this.clearPending(id)
        reject(new JsonRpcError(`send failed: ${method}`))
      }
    })
  }

  /** 알림 전송(응답 없음). initialized 가 유일한 ClientNotification이다. */
  notify(method: string, params?: unknown): void {
    if (this.closed) return
    this.transport.send(JSON.stringify({ jsonrpc: '2.0', method, params }))
  }

  close(): void {
    this.handleClose('client closed')
    this.transport.close()
  }

  private clearPending(id: JsonRpcId): PendingEntry | undefined {
    const entry = this.pending.get(id)
    if (entry?.timer) clearTimeout(entry.timer)
    this.pending.delete(id)
    return entry
  }

  private handleLine(line: string): void {
    const trimmed = line.trim()
    if (!trimmed) return

    let msg: unknown
    try {
      msg = JSON.parse(trimmed)
    } catch {
      // malformed JSON은 통째로 버린다. 내용을 로그에 남기지 않는다
      // (인증정보·학생 데이터가 섞여 있을 수 있음).
      return
    }
    if (typeof msg !== 'object' || msg === null) return
    const m = msg as Record<string, unknown>

    // 응답: id가 있다
    if ('id' in m && (typeof m.id === 'number' || typeof m.id === 'string')) {
      const entry = this.clearPending(m.id)
      if (!entry) return // 이미 타임아웃됐거나 모르는 id
      if ('error' in m && m.error) {
        const err = m.error as Record<string, unknown>
        const message = typeof err.message === 'string' ? err.message : 'unknown error'
        const info = (err.data as Record<string, unknown> | undefined)?.codexErrorInfo
        entry.reject(new JsonRpcError(message, (info as CodexErrorInfo) ?? null))
        return
      }
      entry.resolve(m.result)
      return
    }

    // 알림: method만 있다
    if (typeof m.method === 'string') {
      for (const h of this.notificationHandlers) {
        try {
          h(m.method, m.params)
        } catch {
          // 핸들러 예외가 수신 루프를 죽이지 않게 한다.
        }
      }
    }
  }

  private handleClose(reason: string): void {
    if (this.closed) return
    this.closed = true
    this.closeReason = reason
    // 대기 중이던 요청을 전부 실패시킨다 — 조용히 멈춰 매달리는 것보다 낫다.
    for (const id of [...this.pending.keys()]) {
      const entry = this.clearPending(id)
      entry?.reject(new JsonRpcError(`connection closed: ${reason}`))
    }
  }
}
