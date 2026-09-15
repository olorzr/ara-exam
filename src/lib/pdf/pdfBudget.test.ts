import { describe, it, expect } from 'vitest'
import {
  COLUMN_ENCODE_STEPS, COLUMN_SCALE, DEGRADED_STEP, DEGRADED_WARN_STEP,
  encodeWithinBudget, encodeWithinBudgetStep,
  ENCODE_STEPS, MAX_BATCH_BYTES, MAX_COLUMN_BYTES, MAX_PAGE_BYTES, PAGE_SCALE, pieceBudget,
  STRIP_ENCODE_STEPS,
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

  it('가르기 파일들은 pdfPages 에서 **값을** 가져오지 않는다', async () => {
    const fs = await import('node:fs')
    for (const file of ['pdfColumns.ts', 'pdfRows.ts', 'rowDetect.ts', 'columnDetect.ts']) {
      const src = fs.readFileSync(`src/lib/pdf/${file}`, 'utf8')
      // 타입만 가져오는 import 라야 한다 — 값이면 런타임 순환이 된다
      for (const line of src.split('\n').filter((l) => l.includes("from '@/lib/pdf/pdfPages'"))) {
        expect(line, file).toContain('import type')
      }
    }
  })
})

/** 화질(quality)에 따라 길이가 달라지는 가짜 캔버스 — 축소가 안 걸리게 작게 둔다 */
function fakeCanvas(lengthOf: (quality: number) => number): HTMLCanvasElement {
  return {
    width: 10,
    height: 10,
    toDataURL: (_type: string, quality: number) => 'x'.repeat(lengthOf(quality)),
  } as unknown as HTMLCanvasElement
}

describe('사다리 칸 알리기', () => {
  it('첫 칸에 맞으면 step 0 이다', () => {
    const canvas = fakeCanvas(() => 10)
    expect(encodeWithinBudgetStep(canvas, 100)?.step).toBe(0)
  })

  it('화질을 낮춰야 들어가면 **몇 번째 칸인지**를 알려 준다 — 조용히 낮추지 않기 위해서다', () => {
    // 화질 0.85·0.75 는 예산을 넘고 0.68 부터 들어간다
    const canvas = fakeCanvas((q) => (q > 0.7 ? 200 : 50))
    const got = encodeWithinBudgetStep(canvas, 100)
    expect(got?.step).toBe(2)
    expect(got?.url).toHaveLength(50)
  })

  it('끝까지 못 맞추면 null, 예산이 숫자가 아니면 터뜨린다 (예전 규약 그대로)', () => {
    const canvas = fakeCanvas(() => 500)
    expect(encodeWithinBudgetStep(canvas, 100)).toBeNull()
    expect(encodeWithinBudget(canvas, 100)).toBeNull()
    expect(() => encodeWithinBudgetStep(canvas, Number.NaN)).toThrow('이미지 예산')
  })

  it('기록은 첫 칸을 못 쓴 순간부터, 경고는 그보다 늦게 — 둘을 같게 두지 말 것', () => {
    // ⚠️ 같게 두면 큰 스캔마다 '확인 필요' 칩이 달려 경고 전체를 안 믿게 된다(코덱스 리뷰 P2).
    //    반대로 기록까지 늦추면 흐리게 보낸 사실이 어디에도 안 남는다
    expect(DEGRADED_STEP).toBe(1)
    expect(DEGRADED_WARN_STEP).toBeGreaterThan(DEGRADED_STEP)
    expect(DEGRADED_WARN_STEP).toBeLessThan(STRIP_ENCODE_STEPS.length)
    expect(DEGRADED_WARN_STEP).toBeLessThan(ENCODE_STEPS.length)
  })
})

describe('조각 예산', () => {
  it('갈라 보내도 그 쪽의 총 바이트는 같다', () => {
    expect(pieceBudget(1)).toBe(MAX_PAGE_BYTES)
    expect(pieceBudget(2)).toBe(MAX_COLUMN_BYTES)
    expect(pieceBudget(4) * 4).toBe(MAX_PAGE_BYTES)
  })

  it('0 이나 음수를 줘도 예산이 무한대가 되지 않는다', () => {
    expect(pieceBudget(0)).toBe(MAX_PAGE_BYTES)
  })

  it('조각 사다리의 첫 칸은 3배로 그린 A4 세로를 깎지 않는다', () => {
    // 842pt × COLUMN_SCALE = 2526px. 여기서 깎이면 애써 키운 화소가 사라진다
    expect(STRIP_ENCODE_STEPS[0].maxSide).toBeGreaterThanOrEqual(842 * COLUMN_SCALE)
  })
})
