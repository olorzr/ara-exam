import { describe, it, expect } from 'vitest'
import { findGutter } from './columnDetect'

/**
 * 세로줄별 잉크 비율을 손으로 짓는다.
 * @param spans - [시작비율, 끝비율, 잉크] 구간들. 나머지는 0
 */
function profileOf(spans: [number, number, number][], width = 400): number[] {
  const out = new Array<number>(width).fill(0)
  for (const [from, to, ink] of spans) {
    for (let x = Math.round(from * width); x < Math.round(to * width); x += 1) out[x] = ink
  }
  return out
}

describe('findGutter', () => {
  it('2단 조판의 가운데 홈을 찾는다', () => {
    // 왼쪽 단 · 홈 · 오른쪽 단
    const profile = profileOf([[0.06, 0.47, 0.4], [0.53, 0.94, 0.4]])
    const gutter = findGutter(profile)
    expect(gutter).not.toBeNull()
    expect(gutter!).toBeGreaterThan(0.47)
    expect(gutter!).toBeLessThan(0.53)
  })

  it('1단 조판은 가르지 않는다 — 반으로 자르면 모든 줄이 두 동강 난다', () => {
    expect(findGutter(profileOf([[0.08, 0.92, 0.5]]))).toBeNull()
  })

  it('머리글이 홈을 스쳐도 찾는다 — 위아래 여백은 세지 않으므로 비율이 낮게 남는다', () => {
    const profile = profileOf([[0.06, 0.47, 0.4], [0.53, 0.94, 0.4], [0.47, 0.53, 0.02]])
    expect(findGutter(profile)).not.toBeNull()
  })

  it('한쪽 단이 비어 있으면 가르지 않는다 — 오른쪽 여백을 홈으로 본 것이다', () => {
    expect(findGutter(profileOf([[0.06, 0.45, 0.4]]))).toBeNull()
  })

  it('글자 사이 공백은 홈이 아니다 — 너무 좁다', () => {
    const profile = profileOf([
      [0.06, 0.499, 0.4], [0.501, 0.94, 0.4],
    ])
    expect(findGutter(profile)).toBeNull()
  })

  it('가운데에서 멀리 떨어진 여백은 홈이 아니다', () => {
    // 왼쪽 단이 훨씬 좁은 조판 — 우리 크롭 규약(반반)으로는 다룰 수 없다
    const profile = profileOf([[0.06, 0.2, 0.4], [0.3, 0.94, 0.4]])
    expect(findGutter(profile)).toBeNull()
  })

  it('빈 쪽은 null', () => {
    expect(findGutter(profileOf([]))).toBeNull()
  })

  it('너무 작은 프로파일은 null', () => {
    expect(findGutter([0, 0, 0])).toBeNull()
  })
})
