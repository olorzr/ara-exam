// 연결 카드의 상태 문구 결정 — 순수 함수로 분리해 테스트로 고정한다.
//
// 컴포넌트 안에 두면 분기가 테스트에 안 잡혀,
// "연결 실패가 연결됨으로 표시"·"코덱스 꺼짐이 브라우저 차단으로 표시" 같은
// 회귀가 조용히 통과한다. 문구 자체(JSX)는 컴포넌트가 그리고, **무엇을 그릴지는 여기서 정한다.**

import type { LocalStatus } from './codex/localClient'

/** 연결 실패 시 보여줄 안내의 종류. */
export type HintKind = 'login_required' | 'browser_blocked' | 'not_running'

type FailedStatus = Exclude<LocalStatus, { kind: 'connected' }>

/** 카드 부제에 뜨는 한 줄 상태. */
export function statusLabel(s: LocalStatus | null): string {
  if (!s) return '확인 중…'
  if (s.kind === 'not_running') {
    return s.reason === 'browser_blocked' ? '브라우저가 연결을 막음' : 'Codex 실행 안 됨'
  }
  if (s.kind === 'not_logged_in') return 'ChatGPT 로그인 필요'
  // planType은 표시용일 뿐 사용 가능 여부를 보장하지 않는다.
  // 모르는 값이 와도 깨진 문자열을 그대로 보여주지 않는다.
  if (s.planType === 'plus') return 'ChatGPT Plus 연결됨'
  if (s.planType === 'pro') return 'ChatGPT Pro 연결됨'
  return 'ChatGPT 연결됨'
}

/**
 * 어떤 안내를 보여줄지.
 *
 * ⚠️ browser_blocked는 **권한이 denied일 때만** 나온다. browser_prompt는 여기로 오지 않는다 —
 *   한 번도 물어본 적 없는 origin의 기본 상태가 'prompt'라, codex가 그냥 꺼져 있는
 *   압도적 다수의 경우도 'prompt'로 나오기 때문이다.
 */
export function hintKind(s: FailedStatus): HintKind {
  if (s.kind === 'not_logged_in') return 'login_required'
  if (s.reason === 'browser_blocked') return 'browser_blocked'
  return 'not_running'
}

/** 기존 "Codex 실행 안 됨" 안내에 권한 프롬프트 보조 설명을 덧붙일지. */
export function showsPromptNote(s: FailedStatus): boolean {
  return s.kind === 'not_running' && s.reason === 'browser_prompt'
}
