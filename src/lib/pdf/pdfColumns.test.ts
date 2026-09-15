import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MAX_PAGE_BYTES, type EncodedImage, type EncodeStep } from './pdfBudget'

/**
 * 쪽 하나를 **어떤 이미지 조각들로 보낼지** 정하는 자리.
 *
 * ⚠️ 여기가 틀리면 **조용히** 틀린다 — 글의 절반만 보내거나, 같은 글줄을 두 장에 담아 두 번
 *    옮기게 하거나, 쪽 하나가 예산을 통째로 먹어 다른 쪽을 밀어낸다. 어느 것도 화면에는
 *    아무 표시가 안 남으므로(코덱스 리뷰 P2) 순수 조립 규칙을 여기서 고정한다.
 *
 * 캔버스는 jsdom 에 없다 — `document.createElement('canvas')` 와 가르기 함수를 대역으로 세운다.
 */

vi.mock('@/lib/pdf/columnDetect', () => ({ detectGutter: vi.fn(() => null) }))
vi.mock('@/lib/pdf/rowDetect', () => ({ detectRowGap: vi.fn(() => null), ROW_OVERLAP: 0.0015 }))
vi.mock('@/lib/pdf/pdfRows', () => ({
  cutRows: vi.fn((canvas: HTMLCanvasElement) => [
    fakeCanvas(canvas.width, Math.round(canvas.height * 0.5)),
    fakeCanvas(canvas.width, Math.round(canvas.height * 0.5)),
  ]),
}))

const { detectGutter } = await import('@/lib/pdf/columnDetect')
const { detectRowGap } = await import('@/lib/pdf/rowDetect')
const { encodePageImages } = await import('./pdfColumns')

function fakeCanvas(width: number, height: number): HTMLCanvasElement {
  return {
    width,
    height,
    getContext: () => ({ fillStyle: '', fillRect() {}, drawImage() {} }),
  } as unknown as HTMLCanvasElement
}

/** 인코딩 대역 — 어떤 예산·사다리로 불렸는지 그대로 기록한다 */
function recorder(fail: (canvas: HTMLCanvasElement) => boolean = () => false) {
  const calls: { width: number; height: number; budget: number; firstMaxSide: number }[] = []
  const encode = (canvas: HTMLCanvasElement, budget: number, steps?: EncodeStep[]) => {
    calls.push({
      width: canvas.width, height: canvas.height, budget, firstMaxSide: steps?.[0].maxSide ?? 0,
    })
    return fail(canvas) ? null : ({ url: `u${calls.length}`, step: 0 } as EncodedImage)
  }
  return { calls, encode }
}

const PAGE = () => fakeCanvas(1785, 2526)
const OFF = { columns: false, rows: false, columnRows: false }

beforeEach(() => {
  // ⚠️ 부른 횟수까지 지운다 — 대역은 파일 단위라 앞 테스트의 호출이 그대로 쌓인다
  vi.clearAllMocks()
  vi.mocked(detectGutter).mockReturnValue(null)
  vi.mocked(detectRowGap).mockReturnValue(null)
  // cropColumn 이 쓰는 진짜 캔버스를 대역으로 바꾼다
  vi.spyOn(document, 'createElement').mockImplementation(
    () => fakeCanvas(900, 2526) as unknown as HTMLElement,
  )
})
afterEach(() => vi.restoreAllMocks())

describe('가르지 않을 때', () => {
  it('쪽 통째로 한 장, 예산은 쪽 예산 전부다 (0.7.1 까지와 같다)', () => {
    const { calls, encode } = recorder()
    const out = encodePageImages(PAGE(), OFF, encode)
    expect(out.map((p) => p.part)).toEqual(['full'])
    expect(calls[0].budget).toBe(MAX_PAGE_BYTES)
  })

  it('빈 줄을 못 찾으면 가르지 않는다 — 글줄 한가운데가 잘리는 것보다 낫다', () => {
    const { calls, encode } = recorder()
    const out = encodePageImages(PAGE(), { ...OFF, rows: true }, encode)
    expect(out.map((p) => p.part)).toEqual(['full'])
    expect(calls).toHaveLength(1)
  })

  it('끝내 예산에 못 넣으면 **빈 배열** — 호출부가 그 쪽을 건너뛰고 경고한다', () => {
    const { encode } = recorder(() => true)
    expect(encodePageImages(PAGE(), OFF, encode)).toEqual([])
  })
})

describe('위·아래로 가를 때', () => {
  beforeEach(() => vi.mocked(detectRowGap).mockReturnValue(0.5))

  it('두 장을 위→아래 차례로 내고, 장당 예산은 쪽 예산의 절반이다', () => {
    const { calls, encode } = recorder()
    const out = encodePageImages(PAGE(), { ...OFF, rows: true }, encode)
    expect(out.map((p) => p.part)).toEqual(['top', 'bottom'])
    expect(calls.map((c) => c.budget)).toEqual([MAX_PAGE_BYTES / 2, MAX_PAGE_BYTES / 2])
    // 갈라 보내도 그 쪽이 쓰는 총 바이트는 그대로다
    expect(calls.reduce((n, c) => n + c.budget, 0)).toBe(MAX_PAGE_BYTES)
  })

  it('조각 전용 사다리를 쓴다 — 쪽 사다리는 3배로 그린 세로를 도로 깎는다', () => {
    const { calls, encode } = recorder()
    encodePageImages(PAGE(), { ...OFF, rows: true }, encode)
    expect(calls[0].firstMaxSide).toBeGreaterThan(1800)
    expect(calls[0].height).toBe(1263)
  })

  it('⚠️ 조각 하나가 예산에 안 들어가면 **그 조각을 통째로** 되돌린다 — 반쪽만 보내면 글 절반이 조용히 사라진다', () => {
    // 잘라 낸 조각(세로 1263)만 실패시킨다
    const { calls, encode } = recorder((c) => c.height === 1263)
    const out = encodePageImages(PAGE(), { ...OFF, rows: true }, encode)
    expect(out.map((p) => p.part)).toEqual(['full'])
    // 되돌린 장은 가르기 전과 같은 예산·사다리를 쓴다(화질이 예전보다 나빠지지 않는다)
    const whole = calls[calls.length - 1]
    expect(whole.budget).toBe(MAX_PAGE_BYTES)
    expect(whole.firstMaxSide).toBe(1800)
  })

  it('되돌린 장마저 못 넣으면 빈 배열이다', () => {
    const { encode } = recorder(() => true)
    expect(encodePageImages(PAGE(), { ...OFF, rows: true }, encode)).toEqual([])
  })
})

describe('2단 쪽', () => {
  beforeEach(() => vi.mocked(detectGutter).mockReturnValue(0.5))

  it('단만 가르면 좌·우 두 장이고 예산은 반씩이다 (0.7.1 까지와 같다)', () => {
    const { calls, encode } = recorder()
    const out = encodePageImages(PAGE(), { columns: true, rows: true, columnRows: false }, encode)
    expect(out.map((p) => p.part)).toEqual(['left', 'right'])
    expect(calls.map((c) => c.budget)).toEqual([MAX_PAGE_BYTES / 2, MAX_PAGE_BYTES / 2])
    // ⚠️ columnRows 가 꺼져 있으면 단은 위아래로 가르지 않는다
    expect(detectRowGap).not.toHaveBeenCalled()
  })

  it('단까지 가르면 **읽는 순서대로** 네 장이고, 장당 예산은 1/4 이다', () => {
    vi.mocked(detectRowGap).mockReturnValue(0.5)
    const { calls, encode } = recorder()
    const out = encodePageImages(PAGE(), { columns: true, rows: true, columnRows: true }, encode)
    expect(out.map((p) => p.part))
      .toEqual(['left-top', 'left-bottom', 'right-top', 'right-bottom'])
    expect(calls.map((c) => c.budget)).toEqual(Array(4).fill(MAX_PAGE_BYTES / 4))
  })

  it('한 단만 가를 수 있으면 세 장이고, 총 바이트는 여전히 쪽 예산 안이다', () => {
    let first = true
    vi.mocked(detectRowGap).mockImplementation(() => {
      const gap = first ? 0.5 : null
      first = false
      return gap
    })
    const { calls, encode } = recorder()
    const out = encodePageImages(PAGE(), { columns: true, rows: true, columnRows: true }, encode)
    expect(out.map((p) => p.part)).toEqual(['left-top', 'left-bottom', 'right'])
    expect(calls.reduce((n, c) => n + c.budget, 0)).toBeLessThanOrEqual(MAX_PAGE_BYTES)
  })
})
