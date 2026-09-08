// 선생님 개인 ChatGPT 연동 — 공통 타입
//
// 생성은 **브라우저 ↔ 선생님 PC 의 codex** 사이에서 일어난다.
// 학원 서버(Vercel)는 기능 게이트만 판정하고 AI 를 호출하지 않는다 —
// 그래서 서버 측 provider 추상화를 두지 않는다(교체할 구현체가 없다).
// Codex 세부는 `src/lib/ai/codex/` 안에만 둔다.
//
// 원본: ara-system `app/lib/ai/types.ts` (성적표·상담 도메인 타입은 제외하고 이식)

/** AI 초안을 쓸 수 있는 기능. 기능마다 게이트가 하나씩 붙으므로 무분별하게 늘리지 않는다. */
export type AiFeature = 'problem_ocr';

/** 생성 주체. 현재는 선생님 PC 의 codex 한 가지뿐. */
export type ProviderKind = 'codex_app_server';

/**
 * 사용자에게 노출되는 오류 코드.
 * upstream(Codex/OpenAI) 원문·스택은 절대 그대로 내보내지 않고 반드시 이 코드로 좁힌다.
 */
export type AiErrorCode =
  | 'not_connected'
  | 'device_code_unavailable'
  | 'login_expired'
  | 'unauthorized'
  | 'usage_limit_exceeded'
  | 'provider_unavailable'
  | 'timeout'
  | 'invalid_output'
  /** 보낸 자료가 모델 입력 한도를 넘음 — 사람이 줄이면 해결된다 */
  | 'context_exceeded'
  /** 요청 자체가 거부됨(스키마·형식) — 대개 우리 쪽 버그다. 사용자가 할 수 있는 게 없다 */
  | 'request_rejected'
  | 'sensitive_input_rejected'
  | 'access_denied'
  | 'cancelled'
  | 'feature_disabled';

/** 사용자에게 보여줄 수 있는 형태로 좁혀진 AI 오류 */
export class AiError extends Error {
  constructor(readonly code: AiErrorCode, message?: string) {
    super(message || code);
    this.name = 'AiError';
  }
}

/**
 * 값이 AiError 인지 판정한다(타입 가드).
 * @param e - 검사할 값
 * @returns AiError 면 true
 */
export function isAiError(e: unknown): e is AiError {
  return e instanceof AiError;
}
