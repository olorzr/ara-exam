import { describe, it, expect } from 'vitest'
import { findRowGap, ROW_OVERLAP } from './rowDetect'

/**
 * 가로줄별 잉크 비율을 손으로 짓는다 (columnDetect.test 와 같은 수법).
 * @param spans - [시작비율, 끝비율, 잉크] 구간들. 나머지는 0
 */
function profileOf(spans: [number, number, number][], height = 1000): number[] {
  const out = new Array<number>(height).fill(0)
  for (const [from, to, ink] of spans) {
    for (let y = Math.round(from * height); y < Math.round(to * height); y += 1) out[y] = ink
  }
  return out
}

/** 글줄 사이에 틈이 있는 본문 — `gap` 자리에만 넓은 빈 줄을 둔다 */
function linesWithGap(gap: [number, number]): [number, number, number][] {
  const spans: [number, number, number][] = []
  for (let y = 0.05; y < 0.95; y += 0.02) {
    if (y >= gap[0] - 0.02 && y < gap[1]) continue
    spans.push([y, y + 0.014, 0.4])
  }
  return spans
}

describe('findRowGap', () => {
  it('본문 가운데의 빈 줄에서 가른다', () => {
    const at = findRowGap(profileOf(linesWithGap([0.48, 0.52])))
    expect(at).not.toBeNull()
    expect(at!).toBeGreaterThan(0.46)
    expect(at!).toBeLessThan(0.54)
  })

  it('가운데 띠(0.30~0.70) 밖의 빈 곳은 쓰지 않는다 — 반반에서 너무 멀면 가르는 뜻이 없다', () => {
    // 띠 안은 그림·표처럼 빈틈 없이 차 있고, 넓은 빈 곳은 띠 밖(0.22~0.29)에만 있다
    const spans: [number, number, number][] = [[0.05, 0.22, 0.4], [0.29, 0.95, 0.4]]
    expect(findRowGap(profileOf(spans))).toBeNull()
  })

  it('아래가 비어 있으면 가르지 않는다 — 글자 없는 반쪽을 괜히 보내게 된다', () => {
    const spans = linesWithGap([0.48, 0.52]).filter(([from]) => from < 0.55)
    expect(findRowGap(profileOf(spans))).toBeNull()
  })

  it('틈이 너무 좁으면 가르지 않는다 — 글줄에 획이 걸린다', () => {
    // 줄 간격이 촘촘해 빈 줄이 최소 높이(0.004 = 4줄) 미만인 본문
    const spans: [number, number, number][] = []
    for (let y = 0.05; y < 0.95; y += 0.006) spans.push([y, y + 0.0035, 0.4])
    expect(findRowGap(profileOf(spans))).toBeNull()
  })

  it('넓은 틈(연 사이)이 좁은 틈(줄 사이)을 이긴다', () => {
    const spans = linesWithGap([0.56, 0.60])
    const at = findRowGap(profileOf(spans))
    expect(at).not.toBeNull()
    expect(at!).toBeGreaterThan(0.54)
    expect(at!).toBeLessThan(0.62)
  })

  it('같은 넓이면 가운데에 가까운 틈을 고른다 — 두 장의 글 양이 비슷해야 한다', () => {
    const spans: [number, number, number][] = []
    for (let y = 0.05; y < 0.95; y += 0.02) {
      if ((y >= 0.34 && y < 0.38) || (y >= 0.48 && y < 0.52)) continue
      spans.push([y, y + 0.014, 0.4])
    }
    const at = findRowGap(profileOf(spans))
    expect(at).not.toBeNull()
    expect(at!).toBeGreaterThan(0.44)
  })

  it('빈 쪽·너무 작은 프로파일은 null', () => {
    expect(findRowGap(profileOf([]))).toBeNull()
    expect(findRowGap([0, 0, 0])).toBeNull()
  })
})

describe('겹침', () => {
  it('겹침은 최소 틈의 절반보다 작다 — 그래야 같은 글줄이 두 장에 나오지 않는다', () => {
    // MIN_ROW_GAP 은 파일 안에만 있으므로, 실제로 가르는 가장 좁은 틈으로 견준다.
    // 최소 틈 0.004 기준: 겹침 × 2 < 0.004 여야 겹친 부분이 빈 틈 안에 머문다
    expect(ROW_OVERLAP * 2).toBeLessThan(0.004)
  })
})
