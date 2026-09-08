'use client'
// 브라우저 WebSocket → JsonRpcTransport 어댑터
//
// codex app-server가 선생님 PC에서 `--listen ws://127.0.0.1:PORT`로 떠 있고,
// 관리자센터 화면이 거기에 직접 붙는다. 서버는 이 경로에 관여하지 않는다.
//
// 저장소에 WebSocket 사용 전례가 0건이라 연결 타임아웃·종료 사유를 여기서 처음 정의한다.
// 재연결은 하지 않는다 — 생성은 단발 작업이고, 끊기면 사용자에게 알리는 게 맞다.

import type { JsonRpcTransport } from './jsonRpcClient'

const CONNECT_TIMEOUT_MS = 3000

export class WebSocketTransport implements JsonRpcTransport {
  private ws: WebSocket | null = null
  private lineHandler: ((line: string) => void) | null = null
  private closeHandler: ((reason: string) => void) | null = null
  private closed = false
  /** 열리기 전에 send가 호출되면 여기 모아뒀다가 open 시 흘려보낸다. */
  private queue: string[] = []

  private constructor(private readonly url: string) {}

  /**
   * 연결이 열릴 때까지 기다린다. 실패하면 reject —
   * codex가 안 떠 있는 상태를 "연결됨"으로 오인하지 않기 위해.
   */
  static connect(url: string, timeoutMs = CONNECT_TIMEOUT_MS): Promise<WebSocketTransport> {
    return new Promise((resolve, reject) => {
      const t = new WebSocketTransport(url)
      let ws: WebSocket
      try {
        ws = new WebSocket(url)
      } catch {
        // URL이 잘못됐거나 브라우저 정책(Local Network Access 등)으로 생성 자체가 막히면 던진다.
        // ※ mixed content는 아니다 — 127.0.0.1은 potentially trustworthy라
        //   https 페이지에서도 ws:// 가 차단되지 않는다 (app/lib/ai/localNetworkAccess.ts 참조).
        reject(new Error('ws_connect_failed'))
        return
      }
      t.ws = ws

      const timer = setTimeout(() => {
        try { ws.close() } catch { /* 이미 닫혔으면 무시 */ }
        reject(new Error('ws_connect_timeout'))
      }, timeoutMs)

      ws.onopen = () => {
        clearTimeout(timer)
        for (const line of t.queue) ws.send(line)
        t.queue = []
        resolve(t)
      }

      ws.onmessage = ev => {
        if (typeof ev.data !== 'string') return // 바이너리 프레임은 쓰지 않는다
        // app-server는 JSONL로 보낸다. 한 프레임에 여러 줄이 올 수 있다.
        for (const line of ev.data.split('\n')) {
          const trimmed = line.trim()
          if (trimmed) t.lineHandler?.(trimmed)
        }
      }

      ws.onerror = () => {
        clearTimeout(timer)
        // onerror 뒤에는 onclose가 따라오므로 여기서 close 처리를 중복하지 않는다.
        reject(new Error('ws_connect_failed'))
      }

      ws.onclose = ev => {
        clearTimeout(timer)
        t.handleClose(`ws_closed_${ev.code}`)
      }
    })
  }

  send(line: string): void {
    if (this.closed) throw new Error('ws_closed')
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(line)
    else this.queue.push(line)
  }

  onLine(handler: (line: string) => void): void {
    this.lineHandler = handler
  }

  onClose(handler: (reason: string) => void): void {
    this.closeHandler = handler
  }

  close(): void {
    this.handleClose('client_closed')
    try { this.ws?.close() } catch { /* 이미 닫혔으면 무시 */ }
  }

  private handleClose(reason: string): void {
    if (this.closed) return
    this.closed = true
    this.closeHandler?.(reason)
  }
}
