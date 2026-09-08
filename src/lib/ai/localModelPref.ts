'use client'
// AI 초안 생성에 쓸 모델·추론 노력 선택 (브라우저 전용)
//
// localPort.ts와 같은 이유로 localStorage다 — 탭을 닫아도 남아야 하고,
// 모델 이름·노력 단계는 학생 데이터가 아니므로 공용 PC에 남아도 위험하지 않다.
// null = "기본"(오버라이드를 보내지 않음 → 계정/모델 기본값 사용).

const MODEL_KEY = 'ara-codex-model'
const EFFORT_KEY = 'ara-codex-effort'
const MAX_LEN = 64

export type ModelPref = { model: string | null; effort: string | null }

function read(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw || raw.length > MAX_LEN) return null
    return raw
  } catch {
    // 시크릿 모드 등에서 localStorage 접근이 막힐 수 있다.
    return null
  }
}

function write(key: string, value: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (value && value.length <= MAX_LEN) window.localStorage.setItem(key, value)
    else window.localStorage.removeItem(key)
  } catch {
    // 저장 실패해도 기본값으로 동작하므로 조용히 넘어간다.
  }
}

/**
 * 저장된 모델·추론 노력 선택을 읽는다.
 * @returns 각 값. null 은 "오버라이드하지 않음"(계정·모델 기본값 사용)
 */
export function getCodexModelPref(): ModelPref {
  return { model: read(MODEL_KEY), effort: read(EFFORT_KEY) }
}

/**
 * 모델·추론 노력 선택을 저장한다. null 을 주면 지운다(기본값으로 되돌림).
 * @param pref - 저장할 선택
 */
export function setCodexModelPref(pref: ModelPref): void {
  write(MODEL_KEY, pref.model)
  write(EFFORT_KEY, pref.effort)
}
