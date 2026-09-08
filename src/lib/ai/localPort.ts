'use client'
// 로컬 코덱스 브릿지 포트 설정 (브라우저 전용)
//
// 탭을 닫아도 남아야 하므로 localStorage 를 쓴다.
// 포트 번호는 개인정보가 아니므로 공용 PC 에 남아도 위험하지 않다.
//
// 원본: ara-system `app/lib/ai/localPort.ts`.

const KEY = 'ara-codex-port'
export const DEFAULT_CODEX_PORT = 8899

/**
 * 저장된 브릿지 포트를 읽는다.
 * @returns 저장값 (없거나 범위 밖이면 기본 포트)
 */
export function getCodexPort(): number {
  if (typeof window === 'undefined') return DEFAULT_CODEX_PORT
  try {
    const raw = window.localStorage.getItem(KEY)
    const n = raw ? Number.parseInt(raw, 10) : NaN
    return isValidPort(n) ? n : DEFAULT_CODEX_PORT
  } catch {
    // 시크릿 모드 등에서 localStorage 접근이 막힐 수 있다.
    return DEFAULT_CODEX_PORT
  }
}

/**
 * 브릿지 포트를 저장한다. 범위 밖 값은 무시한다.
 * @param port - 1024~65535 사이 정수
 */
export function setCodexPort(port: number): void {
  if (typeof window === 'undefined') return
  if (!isValidPort(port)) return
  try {
    window.localStorage.setItem(KEY, String(port))
  } catch {
    // 저장 실패해도 기본 포트로 동작하므로 조용히 넘어간다.
  }
}

/**
 * 사용자가 지정할 수 있는 포트 범위인지 검사한다.
 * @param n - 검사할 값
 * @returns 1024~65535 사이 정수면 true
 */
export function isValidPort(n: number): boolean {
  return Number.isInteger(n) && n >= 1024 && n <= 65535
}
