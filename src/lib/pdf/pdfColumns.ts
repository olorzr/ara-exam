'use client'

// 쪽 하나를 **보낼 이미지 조각들**로 만든다 (브라우저 전용).
//
// 가르는 갈래가 둘이다:
//   · 가로(2단 조판) — [columnDetect.ts](./columnDetect.ts): 읽는 순서가 하나뿐이 된다
//   · 세로(빈 줄)   — [rowDetect.ts](./rowDetect.ts): 글자가 더 큰 화소로 보인다
// 어느 쪽이든 **자를 자리를 못 찾으면 가르지 않는다.** 못 갈라 손해 보는 쪽이, 글이 두 동강
// 나는 것보다 훨씬 낫다.

import { detectGutter } from '@/lib/pdf/columnDetect'
import { detectRowGap, ROW_OVERLAP } from '@/lib/pdf/rowDetect'
import { cutRows } from '@/lib/pdf/pdfRows'
import {
  COLUMN_ENCODE_STEPS, COLUMN_OVERLAP, ENCODE_STEPS, pieceBudget, STRIP_ENCODE_STEPS,
  type EncodedImage, type EncodeStep,
} from '@/lib/pdf/pdfBudget'
// ⚠️ 타입만 가져온다 — 값으로 가져오면 `pdfPages` 와 순환 import 가 된다
import type { RenderedPart } from '@/lib/pdf/pdfPages'

/** 예산에 맞춰 캔버스를 data URL 로 만드는 함수 (pdfBudget 의 사다리를 주입받는다) */
type Encode = (
  canvas: HTMLCanvasElement,
  budget: number,
  steps?: EncodeStep[],
) => EncodedImage | null

/** 이 쪽을 어떻게 가를 것인가 */
export interface EncodePageOptions {
  /** 2단 조판이면 단별로 가른다 */
  columns: boolean
  /** 1단 쪽을 빈 줄에서 위·아래로 가른다 */
  rows: boolean
  /** 2단 쪽의 **단까지** 위·아래로 가른다 (쪽 하나가 최대 4장이 된다) */
  columnRows: boolean
}

/** 보낼 이미지 한 장 */
export interface PageImagePiece {
  url: string
  part: RenderedPart
  /** 몇 번째 사다리 칸으로 인코딩했는가 — 호출부가 '화질을 낮췄다' 고 알리는 데 쓴다 */
  step: number
}

/** 가르기 전의 조각 하나 (아직 인코딩하지 않았다) */
interface BasePiece {
  canvas: HTMLCanvasElement
  part: RenderedPart
  /** 통째로 보낼 때 쓸 사다리 — 가르기 전의 화질 규약을 그대로 지킨다 */
  steps: EncodeStep[]
}

/** 위·아래로 가른 뒤의 이름 */
const ROW_PARTS: Partial<Record<RenderedPart, [RenderedPart, RenderedPart]>> = {
  full: ['top', 'bottom'],
  left: ['left-top', 'left-bottom'],
  right: ['right-top', 'right-bottom'],
}

/**
 * 쪽 하나를 보낼 이미지들로.
 * @param canvas - 그려 둔 쪽
 * @param opts - 가르기 설정
 * @param encode - 예산에 맞춰 인코딩하는 함수
 * @returns 보낼 조각들. **하나라도 끝내 못 넣으면 빈 배열**(호출부가 그 쪽을 건너뛴다)
 */
export function encodePageImages(
  canvas: HTMLCanvasElement,
  opts: EncodePageOptions,
  encode: Encode,
): PageImagePiece[] {
  const bases = splitColumns(canvas, opts.columns)
  if (bases.length === 0) return []

  // 조각마다 위·아래로 가를지 먼저 정한다 — **총 장수를 알아야 장당 예산이 정해진다**
  const plans = bases.map((base) => {
    const wantRows = opts.rows && (base.part === 'full' || opts.columnRows)
    const gap = wantRows ? detectRowGap(base.canvas) : null
    return { base, gap }
  })
  const total = plans.reduce((n, p) => n + (p.gap === null ? 1 : 2), 0)
  const budget = pieceBudget(total)

  const out: PageImagePiece[] = []
  for (const { base, gap } of plans) {
    const pieces = gap === null ? null : encodeRows(base, gap, budget, encode)
    if (pieces) { out.push(...pieces); continue }
    // 가를 수 없거나 조각 하나가 예산에 안 들어가면 **통째로** 보낸다.
    // ⚠️ 반쪽만 보내면 그 조각의 글이 절반만 옮겨지는데 경고에는 아무것도 안 남는다.
    //    가르기 전(= 0.6.2 까지)의 예산·사다리를 그대로 쓰므로 화질도 예전과 같다
    const whole = encode(base.canvas, budget * (gap === null ? 1 : 2), base.steps)
    if (!whole) return []
    out.push({ url: whole.url, part: base.part, step: whole.step })
  }
  return out
}

/**
 * 2단이면 단별 캔버스로, 아니면 쪽 통째로.
 * @param canvas - 그려 둔 쪽
 * @param split - 2단이면 가를지
 * @returns 가르기 전 조각들 (단을 잘라내지 못하면 빈 배열)
 */
function splitColumns(canvas: HTMLCanvasElement, split: boolean): BasePiece[] {
  const gutter = split ? detectGutter(canvas) : null
  if (gutter === null) {
    // 1단이거나 못 알아봤다 — 통째로 둔다. 반으로 자르면 모든 줄이 두 동강 난다
    return [{ canvas, part: 'full', steps: ENCODE_STEPS }]
  }

  const overlap = Math.round(canvas.width * COLUMN_OVERLAP)
  const center = Math.round(canvas.width * gutter)
  const left = cropColumn(canvas, 0, Math.min(canvas.width, center + overlap))
  const right = cropColumn(canvas, Math.max(0, center - overlap), canvas.width)
  if (!left || !right) return []
  return [
    { canvas: left, part: 'left', steps: COLUMN_ENCODE_STEPS },
    { canvas: right, part: 'right', steps: COLUMN_ENCODE_STEPS },
  ]
}

/**
 * 조각을 위·아래로 갈라 인코딩한다.
 * @param base - 가르기 전 조각
 * @param gap - 자를 자리 (0~1)
 * @param budget - 장당 예산
 * @param encode - 인코딩 함수
 * @returns 두 장. 하나라도 예산에 못 넣으면 null (호출부가 통째로 되돌린다)
 */
function encodeRows(
  base: BasePiece,
  gap: number,
  budget: number,
  encode: Encode,
): PageImagePiece[] | null {
  const names = ROW_PARTS[base.part]
  if (!names) return null
  const strips = cutRows(base.canvas, gap, ROW_OVERLAP)
  const out: PageImagePiece[] = []
  for (const [i, strip] of strips.entries()) {
    const encoded = encode(strip, budget, STRIP_ENCODE_STEPS)
    if (!encoded) return null
    out.push({ url: encoded.url, part: names[i], step: encoded.step })
  }
  return out
}

/**
 * 쪽에서 가로 구간만 잘라 낸다. **세로는 자르지 않는다** —
 * 그래야 모델이 알려 주는 `top`·`bottom` 이 쪽 전체 기준으로 남아 기출의 크롭이 그대로 맞는다.
 * @param canvas - 그려 둔 쪽
 * @param from - 왼쪽 경계(px)
 * @param to - 오른쪽 경계(px)
 * @returns 잘라 낸 캔버스. 못 만들면 null
 */
function cropColumn(
  canvas: HTMLCanvasElement,
  from: number,
  to: number,
): HTMLCanvasElement | null {
  const width = Math.max(1, to - from)
  const out = document.createElement('canvas')
  out.width = width
  out.height = canvas.height
  const ctx = out.getContext('2d')
  if (!ctx) return null
  // JPEG 는 투명을 모른다 — 안 칠하면 검게 나온다
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, canvas.height)
  ctx.drawImage(canvas, from, 0, width, canvas.height, 0, 0, width, canvas.height)
  return out
}
