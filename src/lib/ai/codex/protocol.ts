// Codex App Server 프로토콜 타입 — 우리가 쓰는 부분만 발췌
//
// 출처: `codex app-server generate-ts --out ./schema` (codex-cli 0.144.5, 2026-07)
// **아래 값들은 실제 app-server와 통신해 응답으로 확인한 것이다**(추측 아님).
//
// ⚠️ 옛 문서와 다른 점:
//  - 오류 타입은 camelCase. `UsageLimitExceeded`(X) → `usageLimitExceeded`(O)
//  - account/login/completed, account/updated 는 요청이 아니라 ServerNotification
//  - ephemeral thread는 config의 history.persistence가 아니라 ThreadStartParams.ephemeral
//  - 아래 메서드는 전부 stable — capabilities.experimentalApi 불필요

/**
 * 이 파일의 형태를 **실제 통신으로 확인한** codex-cli 버전.
 * CLI 를 올린 뒤에는 `codex app-server generate-ts` 로 스키마를 다시 뽑아 대조할 것
 * (README.md '스키마 재생성' 참조).
 */
export const CODEX_CLI_VERIFIED_VERSION = '0.144.5'

/** 우리가 쓰는 요청 메서드. 이 목록 밖은 호출하지 않는다. */
export const USED_METHODS = [
  'initialize',
  'account/read',
  'account/rateLimits/read',
  'model/list',
  'thread/start',
  'turn/start',
  'turn/interrupt',
] as const
export type UsedMethod = typeof USED_METHODS[number]

/**
 * 명시적으로 **쓰지 않는** 메서드. 프로토콜에 실재하며, 실수로 노출되면 곧바로 보안 문제가 된다.
 * codex가 선생님 PC에서 선생님 권한으로 돌기 때문에 서버 격리보다 오히려 위험이 크다.
 */
export const FORBIDDEN_METHODS = [
  'command/exec', 'command/exec/write', 'command/exec/terminate', 'command/exec/resize',
  'fs/readFile', 'fs/writeFile', 'fs/createDirectory', 'fs/remove', 'fs/copy',
  'fs/readDirectory', 'fs/getMetadata', 'fs/watch', 'fs/unwatch',
  'plugin/install', 'plugin/uninstall',
  'mcpServer/tool/call', 'mcpServer/oauth/login',
  'thread/shellCommand',
] as const

/**
 * app-server 실행 시 `--disable`로 꺼야 하는 기능들.
 * **실측 확인**: 이 목록을 적용하면 `mcpServer/startupStatus/updated` 알림이 사라진다
 * (적용 전에는 `codex_apps` MCP가 자동 기동됨).
 * 시작 스크립트(public/ara-ai/start-codex.cmd)와 반드시 동기화할 것.
 * → __tests__/lib/aiDisabledFeaturesSync.test.ts 가 두 목록을 대조해 어긋나면 실패시킨다.
 */
export const DISABLED_FEATURES = [
  'apps',
  'browser_use', 'browser_use_external', 'browser_use_full_cdp_access', 'in_app_browser',
  'computer_use',
  'hooks',
  'image_generation',
  'plugins', 'plugin_sharing', 'remote_plugin',
  'shell_tool', 'unified_exec', 'shell_snapshot',
  'skill_mcp_dependency_install', 'tool_call_mcp_elicitation',
] as const

export type PlanType =
  | 'free' | 'go' | 'plus' | 'pro' | 'prolite' | 'team'
  | 'self_serve_business_usage_based' | 'business'
  | 'enterprise_cbp_usage_based' | 'enterprise' | 'edu' | 'unknown'

export type AuthMode =
  | 'apikey' | 'chatgpt' | 'chatgptAuthTokens' | 'headers'
  | 'agentIdentity' | 'personalAccessToken' | 'bedrockApiKey'

export type CodexErrorInfo =
  | 'contextWindowExceeded' | 'sessionBudgetExceeded' | 'usageLimitExceeded'
  | 'serverOverloaded' | 'cyberPolicy' | 'internalServerError' | 'unauthorized'
  | 'badRequest' | 'threadRollbackFailed' | 'sandboxError' | 'other'
  | { httpConnectionFailed: { httpStatusCode: number | null } }
  | { responseStreamConnectionFailed: Record<string, unknown> }
  | { responseStreamDisconnected: Record<string, unknown> }
  | { responseTooManyFailedAttempts: Record<string, unknown> }
  | { activeTurnNotSteerable: Record<string, unknown> }

export type InitializeCapabilities = {
  experimentalApi: boolean
  requestAttestation: boolean
  /** reasoning delta 등 받고 싶지 않은 알림을 끈다. */
  optOutNotificationMethods?: string[] | null
}

/**
 * initialize 응답. **실측 형태**:
 * `{ userAgent, codexHome, platformFamily, platformOs }`
 *
 * ⚠️ `userAgent`는 우리가 보낸 clientInfo.name을 되돌려준다
 * (예: `academy_teacher_writing_beta/0.144.5 (Mac OS 26.5.2; arm64) ...`).
 * 따라서 "userAgent에 codex가 들어있는지"로는 상대가 codex인지 판별할 수 없다.
 * → 포트를 다른 앱이 점유했는지는 `codexHome`+`platformOs` 존재 여부로 확인한다.
 */
export type InitializeResponse = {
  userAgent?: string
  codexHome?: string
  platformFamily?: string
  platformOs?: string
}

/** 상대가 정말 codex app-server인지 확인. 다른 로컬 앱이 같은 포트를 쓰는 경우 방어. */
export function looksLikeCodex(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false
  const r = result as InitializeResponse
  return typeof r.codexHome === 'string' && r.codexHome.length > 0
    && typeof r.platformOs === 'string' && r.platformOs.length > 0
}

export type SandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access'
export type AskForApproval = 'untrusted' | 'on-request' | 'never'

/** 쓰기·네트워크 모두 차단. **실측**으로 thread/start 응답에 그대로 반영됨을 확인했다. */
export type SandboxPolicy =
  | { type: 'readOnly'; networkAccess: boolean }
  | { type: 'dangerFullAccess' }

export const LOCKED_SANDBOX: SandboxPolicy = { type: 'readOnly', networkAccess: false }

export type ThreadStartParams = {
  /** 디스크에 남기지 않는 스레드. **항상 true로 쓴다.** */
  ephemeral?: boolean | null
  /** 학생 데이터·저장소가 없는 전용 빈 디렉터리. */
  cwd?: string | null
  sandbox?: SandboxMode | null
  approvalPolicy?: AskForApproval | null
}

/**
 * ⚠️ **실측**: text 변형에 `text_elements` 배열이 **필수**다. 빠뜨리면 요청이 거부된다.
 * image 변형은 **data URL이 동작**한다(실측: vision 인식 확인, ws 단일 프레임 3.2MB 통과).
 * localImage(선생님 PC 경로)·skill·mention 변형은 이 기능에서 쓰지 않는다.
 */
export type UserInput =
  | { type: 'text'; text: string; text_elements: [] }
  | { type: 'image'; url: string }

/**
 * 한 turn에 실을 수 있는 이미지 **와이어 클램프** — 버그로 수십 장이 나가는 걸 막는 최종 방어선이다.
 *
 * ⚠️ 아는 것과 모르는 것을 섞지 말 것:
 *  · **실측** — 이미지 5장 · data URL 프레임 3.2MB가 **통과**했다. vision 인식도 확인.
 *  · **미측정** — 프레임/메시지의 실제 상한과 실패점. 3.2MB 는 "통과한 값"이지 천장이 아니다.
 *    상한을 거는 주체가 있다면 선생님 PC의 codex app-server 뿐이다 —
 *    우리 브릿지(public/ara-ai/bridge.cjs)는 101 이후 raw TCP splice라 프레임을 파싱조차 안 한다.
 *
 * 그래서 '전체 쪽 읽기'는 이 값을 키워서 푸는 게 아니라 **묶음으로 나눠 여러 turn**으로 푼다
 * (실제 정책값은 pdfPages.ts 의 PAGES_PER_BATCH). 여기 8은 그 정책이 어긋났을 때의 안전판이다.
 */
export const MAX_TURN_IMAGES = 8

export type TurnStartParams = {
  threadId: string
  input: UserInput[]
  /** 구조화 출력 강제. **실측으로 동작 확인** — 모델이 스키마 모양 JSON 문자열을 반환한다. */
  outputSchema?: unknown
  sandboxPolicy?: SandboxPolicy
  approvalPolicy?: AskForApproval
  /** 이 턴(이후 턴 포함)의 모델 오버라이드. 미지정이면 계정 기본 모델. */
  model?: string | null
  /** 이 턴(이후 턴 포함)의 추론 노력 오버라이드. 값은 model/list가 알려준 것만 쓴다. */
  effort?: string | null
}

/** model/list 응답의 effort 선택지. */
export type CodexReasoningEffortOption = { reasoningEffort: string; description: string }

/**
 * model/list 응답의 모델 항목 — 우리가 쓰는 부분만 발췌.
 * 전체 스키마에는 serviceTiers·inputModalities 등이 더 있다(입력은 text/image뿐 — PDF 없음).
 */
export type CodexModel = {
  /** turn/start의 model 필드에 넣는 값. */
  id: string
  displayName: string
  description: string
  isDefault: boolean
  defaultReasoningEffort: string
  supportedReasoningEfforts: CodexReasoningEffortOption[]
}

/**
 * reasoning 관련 델타는 프론트로 전달하지도, 로그로 남기지도 않는다.
 * 최종 agentMessage만 필요하므로 delta 계열은 전부 끈다.
 */
export const OPT_OUT_NOTIFICATIONS: string[] = [
  'item/reasoning/textDelta',
  'item/reasoning/summaryTextDelta',
  'item/reasoning/summaryPartAdded',
  'item/agentMessage/delta',
  'item/commandExecution/outputDelta',
  'item/fileChange/outputDelta',
  'item/plan/delta',
  'turn/diff/updated',
  'turn/plan/updated',
  'process/outputDelta',
]

/** initialize에 넣을 클라이언트 식별자. OpenAI 승인 여부를 함의하지 않는 이름을 쓴다. */
export const CLIENT_INFO = {
  name: 'ara_exam_problem_bank_beta',
  title: 'Ara Exam Problem Bank Beta',
} as const

/**
 * 최종 답변 판별. **실측 형태**:
 * `item/completed` → `{ item: { type: 'agentMessage', text: '<JSON 문자열>', phase: 'final_answer' } }`
 */
export function extractFinalAnswer(params: unknown): string | null {
  if (!params || typeof params !== 'object') return null
  const item = (params as { item?: unknown }).item
  if (!item || typeof item !== 'object') return null
  const it = item as { type?: unknown; text?: unknown; phase?: unknown }
  if (it.type !== 'agentMessage') return null
  if (it.phase !== 'final_answer') return null
  return typeof it.text === 'string' ? it.text : null
}
