'use client'

// 2단 조판 쪽을 **단별 이미지**로 가르는 인코딩 (브라우저 전용).
//
// `pdfPages.ts` 에서 떼어 둔 이유는 길이지만, 덕분에 "쪽을 어떤 이미지들로 보낼까" 라는
// 판단이 한 자리에 모였다. 왜 가르는지는 `columnDetect.ts` 머리말에 적었다.

import { detectGutter } from '@/lib/pdf/columnDetect'
import {
  COLUMN_ENCODE_STEPS, COLUMN_OVERLAP, MAX_COLUMN_BYTES, MAX_PAGE_BYTES,
} from '@/lib/pdf/pdfBudget'
// ⚠️ 타입만 가져온다 — 값으로 가져오면 `pdfPages` 와 순환 import 가 된다
import type { RenderedPart } from '@/lib/pdf/pdfPages'

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
