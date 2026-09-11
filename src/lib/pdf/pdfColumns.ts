'use client'

// 2단 조판 쪽을 **단별 이미지**로 가르는 인코딩 (브라우저 전용).
//
// `pdfPages.ts` 에서 떼어 둔 이유는 길이지만, 덕분에 "쪽을 어떤 이미지들로 보낼까" 라는
// 판단이 한 자리에 모였다. 왜 가르는지는 `columnDetect.ts` 머리말에 적었다.

import { detectGutter } from '@/lib/pdf/columnDetect'
import { MAX_PAGE_BYTES, type RenderedPart } from '@/lib/pdf/pdfPages'

/**
 * 단 하나짜리 이미지의 예산.
 *
 * 쪽 예산의 **절반**이다 — 2단 쪽을 갈라 보내도 그 쪽이 쓰는 총 바이트가 예전과 같아야
 * 묶음 총량과 진행률 계산이 흔들리지 않는다. 넓이도 절반이라 글자당 화질은 그대로다.
 */
const MAX_COLUMN_BYTES = MAX_PAGE_BYTES / 2

/**
 * 단을 갈라 보낼 때의 배율.
 *
 * 더 크게 그리는 이유: 인코딩 사다리의 `maxSide` 가 **긴 변(세로)** 에 걸리는데,
 * 단 이미지는 세로가 쪽 전체와 같고 가로만 절반이다. 배율을 올리면 세로는 사다리가
 * 되돌리고 **가로 화소만 남는다** — A4 기준 단 하나가 595px 에서 892px 로 넓어진다.
 */
export const COLUMN_SCALE = 3

/** 단을 자를 때 안쪽으로 더 잡는 여유 (폭 대비). 경계에 걸친 글자가 잘리지 않게 한다 */
const COLUMN_OVERLAP = 0.01

/**
 * 단 이미지 전용 인코딩 사다리.
 *
 * 1단의 `maxSide` 가 쪽 사다리(1800)보다 큰 이유는 위 `COLUMN_SCALE` 주석과 같다 —
 * 1800 을 그대로 쓰면 애써 키운 가로 화소를 세로에 걸린 상한이 도로 깎는다.
 */
const COLUMN_ENCODE_STEPS: { maxSide: number; quality: number }[] = [
  { maxSide: 2600, quality: 0.82 },
  { maxSide: 2200, quality: 0.76 },
  { maxSide: 1800, quality: 0.70 },
  { maxSide: 1500, quality: 0.60 },
]

/** 예산에 맞춰 캔버스를 data URL 로 만드는 함수 (pdfPages 의 사다리를 주입받는다) */
type Encode = (
  canvas: HTMLCanvasElement,
  budget: number,
  steps?: { maxSide: number; quality: number }[],
) => string | null

/**
 * 쪽 하나를 보낼 이미지들로. 2단이면 단별로 가른다.
 * @param canvas - 그려 둔 쪽
 * @param split - 2단이면 가를지
 * @param encodeWithinBudget - 예산에 맞춰 인코딩하는 함수
 * @returns 보낼 조각들. 하나라도 예산을 못 맞추면 **빈 배열**(호출부가 그 쪽을 건너뛴다)
 */
export function encodePageImages(
  canvas: HTMLCanvasElement,
  split: boolean,
  encodeWithinBudget: Encode,
): { url: string; part: RenderedPart }[] {
  const gutter = split ? detectGutter(canvas) : null

  if (gutter === null) {
    // 1단이거나 못 알아봤다 — 통째로 보낸다. 반으로 자르면 모든 줄이 두 동강 난다
    const url = encodeWithinBudget(canvas, MAX_PAGE_BYTES)
    return url ? [{ url, part: 'full' }] : []
  }

  const overlap = Math.round(canvas.width * COLUMN_OVERLAP)
  const center = Math.round(canvas.width * gutter)
  const left = cropColumn(canvas, 0, Math.min(canvas.width, center + overlap), encodeWithinBudget)
  const right = cropColumn(canvas, Math.max(0, center - overlap), canvas.width, encodeWithinBudget)
  if (!left || !right) return []

  return [{ url: left, part: 'left' }, { url: right, part: 'right' }]
}

/**
 * 쪽에서 가로 구간만 잘라 JPEG data URL 로. **세로는 자르지 않는다** —
 * 그래야 모델이 알려 주는 `top`·`bottom` 이 쪽 전체 기준으로 남아 크롭이 그대로 맞는다.
 * @param canvas - 그려 둔 쪽
 * @param from - 왼쪽 경계(px)
 * @param to - 오른쪽 경계(px)
 * @param encodeWithinBudget - 예산에 맞춰 인코딩하는 함수
 * @returns data URL. 예산을 못 맞추면 null
 */
function cropColumn(
  canvas: HTMLCanvasElement,
  from: number,
  to: number,
  encodeWithinBudget: Encode,
): string | null {
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
  return encodeWithinBudget(out, MAX_COLUMN_BYTES, COLUMN_ENCODE_STEPS)
}
