'use client'
// 읽기(OCR) 턴에 쓸 모델·추론 노력을 정한다.
//
// **왜 앱이 정하는가.** 아무것도 안 보내면 선생님 PC 의 `~/.codex/config.toml` 이 정한
// 기본 모델·기본 노력으로 돈다(실측: `model_reasoning_effort = "low"`). 대화용으로는 알맞은
// 설정이지만 **시험지 전사는 한 글자만 틀려도 시험지가 틀린다** — 낮은 노력으로 읽으면
// 낱말이 바뀌거나 행이 빠진 채 그럴듯한 결과가 돌아온다. 그리고 `ocr_meta.model` 이
// null 이라 무엇으로 읽었는지 나중에 알 수도 없었다.
//
// ⚠️ **모델 id 를 코드에 박지 않는다**(AiModelSelect.tsx)는 규약의 의도된 예외다.
//    여기 적는 것은 **요구가 아니라 선호 목록**이고, 매번 `model/list` 로 실재를 확인한 뒤
//    없으면 계정 기본 모델로 물러선다. 단종되면 `ocr_meta.model` 에 다른 값이 남아 드러난다.
// ⚠️ **선생님이 설정에서 고른 값이 늘 이긴다.** 고른 적이 없을 때만 우리가 정한다.
// ⚠️ 이 값은 **본문 읽기 턴에만** 쓴다. 쪽 방향 판정·단어 등록까지 높이면 싼 단계가 비싸진다.

import { listLocalModels } from './codex/localClient'
import type { CodexModel } from './codex/protocol'
import type { ModelPref } from './localModelPref'

/** 어떤 모델·노력을 선호하는가 (기능마다 다를 수 있어 호출부가 준다) */
export interface OcrPrefPolicy {
  /** 선호 모델 id — 목록에 있는 **첫 번째**를 쓴다 */
  models: readonly string[]
  /** 선호 노력 — 그 모델이 지원하는 **첫 번째**를 쓴다 */
  efforts: readonly string[]
}

/**
 * 모델 목록과 선생님 선택으로 이번 턴의 모델·노력을 정한다 (순수 함수).
 *
 * ⚠️ **모델 id 를 늘 함께 싣는다.** `generateDraft` 의 `sanitizeOverride` 는 노력이 유효한지
 *    **모델의 지원 목록으로** 판정하는데, 모델을 안 보내면 어느 모델이 기본인지 알 수 없어
 *    노력을 통째로 버린다(그러면 아무것도 안 한 것과 같다).
 * @param models - `model/list` 응답
 * @param pref - 선생님이 설정에서 고른 값 (null = 안 고름)
 * @param policy - 선호 모델·노력
 * @returns 이번 턴에 보낼 값. 고를 수 없으면 `pref` 그대로(= 예전처럼 계정 기본값)
 */
export function resolveOcrPref(
  models: readonly CodexModel[],
  pref: ModelPref,
  policy: OcrPrefPolicy,
): ModelPref {
  const target = pref.model
    // 선생님이 고른 모델이 목록에 없으면(단종·요금제 변경) 우리가 고르지 않는다 —
    // 그 판정은 `sanitizeOverride` 가 이미 하고, 여기서 다른 모델로 바꾸면 고른 값을 무른다
    ? models.find((m) => m.id === pref.model)
    : policy.models.map((id) => models.find((m) => m.id === id)).find(Boolean)
      ?? models.find((m) => m.isDefault)

  if (!target) return pref

  const effort = pref.effort
    ?? policy.efforts.find(
      (e) => target.supportedReasoningEfforts.some((o) => o.reasoningEffort === e),
    )
    ?? null

  return { model: target.id, effort }
}

/**
 * 브릿지에 모델 목록을 물어 이번 턴의 값을 정한다.
 *
 * **fail-open** 이다 — 목록을 못 받으면 `pref` 그대로 둔다. 보조 단계의 실패가 읽기 자체를
 * 막으면 안 된다(방향 판정과 같은 규약).
 * @param port - 로컬 브릿지 포트
 * @param pref - 선생님이 고른 값
 * @param policy - 선호 모델·노력
 * @returns 이번 턴에 보낼 값
 */
export async function resolveOcrPrefFromBridge(
  port: number,
  pref: ModelPref,
  policy: OcrPrefPolicy,
): Promise<ModelPref> {
  const models = await listLocalModels(port)
  return models ? resolveOcrPref(models, pref, policy) : pref
}
