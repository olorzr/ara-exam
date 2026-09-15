import { describe, it, expect } from 'vitest'
import { resolveOcrPref, type OcrPrefPolicy } from './ocrPref'
import type { CodexModel } from './codex/protocol'

/**
 * 읽기 턴의 모델·노력 고르기.
 *
 * ⚠️ 여기가 틀리면 **조용히 예전으로 돌아간다** — 낮은 노력으로 읽고, 아무도 모른다.
 *    그래서 "고를 수 없으면 pref 그대로" 인 갈래까지 전부 고정한다.
 */

const model = (id: string, efforts: string[], isDefault = false): CodexModel => ({
  id,
  displayName: id,
  description: '',
  isDefault,
  defaultReasoningEffort: efforts[0] ?? '',
  supportedReasoningEfforts: efforts.map((e) => ({ reasoningEffort: e, description: '' })),
})

const LIST: CodexModel[] = [
  model('gpt-6-astra', ['low', 'medium', 'high'], true),
  model('gpt-5.6-terra', ['low', 'medium', 'high', 'xhigh']),
  model('gpt-5.5', ['low', 'medium']),
]

const POLICY: OcrPrefPolicy = { models: ['gpt-5.6-terra'], efforts: ['high', 'medium'] }
const NONE = { model: null, effort: null }

describe('resolveOcrPref', () => {
  it('선호 모델이 목록에 있으면 그것을 높은 노력으로 — 기본 모델(astra)을 쓰지 않는다', () => {
    expect(resolveOcrPref(LIST, NONE, POLICY)).toEqual({ model: 'gpt-5.6-terra', effort: 'high' })
  })

  it('선호 모델이 없으면 계정 기본 모델로 물러서되 노력은 올린다', () => {
    const list = LIST.filter((m) => m.id !== 'gpt-5.6-terra')
    expect(resolveOcrPref(list, NONE, POLICY)).toEqual({ model: 'gpt-6-astra', effort: 'high' })
  })

  it('선생님이 고른 모델이 늘 이긴다 — 우리가 다른 모델로 바꾸지 않는다', () => {
    expect(resolveOcrPref(LIST, { model: 'gpt-5.5', effort: null }, POLICY))
      .toEqual({ model: 'gpt-5.5', effort: 'medium' })
  })

  it('선생님이 고른 노력도 그대로 둔다', () => {
    expect(resolveOcrPref(LIST, { model: null, effort: 'low' }, POLICY))
      .toEqual({ model: 'gpt-5.6-terra', effort: 'low' })
  })

  it('선호 순서대로 **처음 지원되는** 노력을 고른다', () => {
    const list = [model('gpt-5.6-terra', ['low', 'medium'])]
    expect(resolveOcrPref(list, NONE, POLICY)).toEqual({ model: 'gpt-5.6-terra', effort: 'medium' })
  })

  it('지원하는 노력이 하나도 없으면 노력만 비우고 **모델은 싣는다** — 안 실으면 오버라이드가 통째로 버려진다', () => {
    const list = [model('gpt-5.6-terra', ['none'])]
    expect(resolveOcrPref(list, NONE, POLICY)).toEqual({ model: 'gpt-5.6-terra', effort: null })
  })

  it('목록이 비었거나 기본 모델이 없으면 pref 그대로 — 예전처럼 계정 기본값으로 읽는다', () => {
    expect(resolveOcrPref([], NONE, POLICY)).toEqual(NONE)
    expect(resolveOcrPref([model('gpt-5.5', ['low'])], NONE, POLICY)).toEqual(NONE)
  })

  it('선생님이 고른 모델이 목록에 없으면(단종) 손대지 않는다 — 고른 값을 무르지 않는다', () => {
    const pref = { model: 'gpt-4-old', effort: null }
    expect(resolveOcrPref(LIST, pref, POLICY)).toEqual(pref)
  })
})
