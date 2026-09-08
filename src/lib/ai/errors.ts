// AI 오류 코드 → 사용자 문구
//
// upstream(OpenAI/Codex) 원문 메시지·스택·토큰은 프론트로 절대 내보내지 않는다.
// 반드시 AiErrorCode로 좁힌 뒤 여기서 한글로 바꾼다.
// 원본: ara-system `app/lib/ai/errors.ts`.

import type { AiErrorCode } from './types'

const MESSAGES: Record<AiErrorCode, string> = {
  not_connected: '먼저 개인 ChatGPT 계정을 연결해 주세요.',
  device_code_unavailable: '현재 이 계정 또는 환경에서는 기기 코드 로그인을 사용할 수 없습니다.',
  login_expired: '인증 시간이 만료되었습니다. 다시 연결해 주세요.',
  unauthorized: 'ChatGPT 인증이 만료되었거나 해제되었습니다. 다시 연결해 주세요.',
  usage_limit_exceeded: '현재 계정의 Codex 사용 한도에 도달했습니다. 한도 초기화 후 다시 이용해 주세요.',
  provider_unavailable: '현재 AI 서비스를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  timeout: '생성 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.',
  invalid_output: 'AI 결과 형식이 올바르지 않아 적용하지 않았습니다.',
  context_exceeded: '한 번에 보낸 자료가 너무 많아 AI가 다 읽지 못했어요. 읽을 쪽 수를 줄여서 다시 시도해 주세요.',
  request_rejected: 'AI가 요청을 거부했어요. 자료 문제가 아니라 프로그램 문제일 수 있으니, 반복되면 알려주세요.',
  sensitive_input_rejected: '민감한 정보가 포함되어 AI 생성을 진행하지 않았습니다.',
  access_denied: '이 자료에 접근할 권한이 없습니다.',
  cancelled: 'AI 생성을 취소했습니다.',
  feature_disabled: '지금은 사용할 수 없는 기능입니다.',
}

/**
 * 오류 코드를 사용자에게 보여줄 한글 문구로 바꾼다.
 * @param code - AI 오류 코드
 * @returns 한글 안내 문구 (모르는 코드는 일반 실패 문구)
 */
export function aiErrorMessage(code: AiErrorCode): string {
  return MESSAGES[code] || MESSAGES.provider_unavailable
}

/**
 * CodexErrorInfo 의 판별자 추출.
 *
 * ⚠️ **같은 오류가 두 가지 모양으로 온다.** serde 의 외부 태그(externally tagged) 표현이라,
 * 딸린 정보가 없으면 문자열(`"unauthorized"`), 있으면 키가 하나인 객체
 * (`{ usageLimitExceeded: { resetsAt } }`, `{ httpConnectionFailed: { … } }`)로 온다.
 *
 * 예전엔 문자열 switch 와 객체 처리(키 2개)가 따로 있어서, **정보가 딸린 오류가 전부
 * 기본값 provider_unavailable 로 샜다.** 실제로 사용량 한도 초과가
 * "현재 AI 서비스를 사용할 수 없습니다"로 나와 원인을 못 찾은 사례가 있었다(2026-08-04).
 */
function codexErrorKey(info: unknown): string {
  if (typeof info === 'string') return info
  if (info && typeof info === 'object' && !Array.isArray(info)) {
    return Object.keys(info as Record<string, unknown>)[0] ?? ''
  }
  return ''
}

/**
 * Codex App Server의 CodexErrorInfo → 우리 오류 코드.
 *
 * 주의: codex-cli 스키마 기준으로 **camelCase**다(protocol.ts 의 CODEX_CLI_VERIFIED_VERSION 참조).
 * 옛 문서의 `UsageLimitExceeded`/`Unauthorized`(PascalCase)는 현재 스키마에 없다.
 *
 * 문자열·객체 두 표현을 **한 switch 로** 처리한다 — 분기가 갈리면 한쪽만 고치게 된다.
 */
export function mapCodexError(info: unknown): AiErrorCode {
  switch (codexErrorKey(info)) {
    case 'usageLimitExceeded':
    case 'sessionBudgetExceeded':
      return 'usage_limit_exceeded'
    case 'unauthorized':
      return 'unauthorized'
    // ⚠️ 이 둘을 invalid_output 으로 뭉뚱그리면 안 된다.
    //    셋 다 "빨리 실패"하는데 원인도 대응도 완전히 다르다:
    //    입력 과다(사람이 줄이면 됨) / 요청 거부(우리 버그) / 결과 형식 불량(모델이 이상하게 답함).
    //    예전엔 전부 "AI 결과 형식이 올바르지 않아 적용하지 않았습니다"로 나와 원인을 가렸다.
    case 'contextWindowExceeded':
      return 'context_exceeded'
    case 'badRequest':
      return 'request_rejected'
    case 'responseStreamDisconnected':
    case 'responseStreamConnectionFailed':
      return 'timeout'
    case 'serverOverloaded':
    case 'internalServerError':
    case 'httpConnectionFailed':
      return 'provider_unavailable'
    default:
      return 'provider_unavailable'
  }
}

/**
 * planType 표시 라벨. 모르는 값이 와도 깨진 문자열을 그대로 보여주지 않는다.
 * planType은 표시용일 뿐 사용 가능 여부를 보장하지 않는다 — 실제 판정은 요청 성공/한도 상태로 한다.
 */
export function planLabel(planType?: string | null): string {
  switch (planType) {
    case 'plus': return 'ChatGPT Plus 연결됨'
    case 'pro': return 'ChatGPT Pro 연결됨'
    case 'business':
    case 'enterprise':
    case 'edu':
    case 'team': return 'ChatGPT 연결됨'
    default: return 'ChatGPT 연결됨'
  }
}
