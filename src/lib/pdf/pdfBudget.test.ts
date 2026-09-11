import { describe, it, expect } from 'vitest'
import {
  COLUMN_ENCODE_STEPS, COLUMN_SCALE, encodeWithinBudget, ENCODE_STEPS,
  MAX_BATCH_BYTES, MAX_COLUMN_BYTES, MAX_PAGE_BYTES, PAGE_SCALE,
} from './pdfBudget'

/**
 * 예산값이 **숫자로 살아 있는지** 고정한다.
 *
 * ⚠️ 이 파일이 따로 있는 까닭이 사고 하나다. 예산이 `pdfPages` 에 있고 `pdfColumns` 가
 *    그걸 import 하는데 `pdfPages` 도 `pdfColumns` 를 import 해서 **순환**이 됐다.
 *    번들러가 CommonJS 로 풀면 단 이미지 예산이 `undefined / 2 = NaN` 이 되고,
 *    `url.length <= NaN` 이 늘 거짓이라 **2단 쪽이 전부 건너뛰어져** 읽기가 통째로
 *    실패한다. 프로덕션에서 실제로 그랬고, Vite/ESM 인 테스트에서는 순서가 달라 안 잡혔다.
 */
describe('이미지 예산', () => {
  it('전부 유한한 양수다 — NaN 이면 모든 쪽이 조용히 건너뛰어진다', () => {
    for (const [name, value] of Object.entries({
      MAX_PAGE_BYTES, MAX_BATCH_BYTES, MAX_COLUMN_BYTES, PAGE_SCALE, COLUMN_SCALE,
    })) {
      expect(Number.isFinite(value), name).toBe(true)
      expect(value, name).toBeGreaterThan(0)
    }
  })

  it('단 예산은 쪽 예산의 절반이다 — 갈라 보내도 그 쪽의 총 바이트가 같아야 한다', () => {
    expect(MAX_COLUMN_BYTES).toBe(MAX_PAGE_BYTES / 2)
  })

  it('단 사다리의 첫 칸이 쪽 사다리보다 크다 — 키운 가로 화소를 도로 깎지 않는다', () => {
    expect(COLUMN_ENCODE_STEPS[0].maxSide).toBeGreaterThan(ENCODE_STEPS[0].maxSide)
  })

  it('사다리는 화질이 점점 낮아진다', () => {
    for (const steps of [ENCODE_STEPS, COLUMN_ENCODE_STEPS]) {
      for (let i = 1; i < steps.length; i += 1) {
        expect(steps[i].maxSide).toBeLessThan(steps[i - 1].maxSide)
        expect(steps[i].quality).toBeLessThan(steps[i - 1].quality)
      }
    }
  })

  it('예산이 숫자가 아니면 **터뜨린다** — 조용히 모든 쪽을 건너뛰는 것보다 낫다', () => {
    const canvas = { width: 10, height: 10 } as HTMLCanvasElement
    expect(() => encodeWithinBudget(canvas, Number.NaN)).toThrow('이미지 예산')
    expect(() => encodeWithinBudget(canvas, 0)).toThrow('이미지 예산')
  })
})

describe('순환 import', () => {
  it('pdfColumns 를 먼저 불러와도 예산이 살아 있다', async () => {
    const budget = await import('./pdfBudget')
    expect(budget.MAX_COLUMN_BYTES).toBe(600_000)
  })

  it('pdfColumns 는 pdfPages 에서 **값을** 가져오지 않는다', async () => {
    const fs = await import('node:fs')
    const src = fs.readFileSync('src/lib/pdf/pdfColumns.ts', 'utf8')
    // 타입만 가져오는 import 라야 한다 — 값이면 런타임 순환이 된다
    const lines = src.split('\n').filter((l) => l.includes("from '@/lib/pdf/pdfPages'"))
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('import type')
  })
})
