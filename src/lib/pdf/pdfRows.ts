'use client'

// 조각 하나를 위·아래 두 장으로 자른다 (브라우저 전용).
//
// 왜 자르는지는 [rowDetect.ts](./rowDetect.ts) 머리말에 있다. 여기는 자르는 일만 한다 —
// `pdfColumns.ts` 의 `cropColumn` 과 같은 자리다(그쪽은 가로, 이쪽은 세로).

/**
 * 빈 줄 가운데에서 위·아래로 자른다.
 *
 * ⚠️ **겹침은 빈 틈 안에 머물러야 한다**(`ROW_OVERLAP < MIN_ROW_GAP / 2`). 넘으면 같은
 *    글줄이 두 장에 다 나와 모델이 그 줄을 두 번 옮긴다.
 * @param canvas - 그려 둔 조각
 * @param gap - 자를 자리(0~1, 높이 대비)
 * @param overlap - 서로 더 잡을 여유(0~1, 높이 대비)
 * @returns [위쪽, 아래쪽]
 */
export function cutRows(
  canvas: HTMLCanvasElement,
  gap: number,
  overlap: number,
): [HTMLCanvasElement, HTMLCanvasElement] {
  const height = canvas.height
  const margin = Math.round(height * overlap)
  const center = Math.round(height * gap)
  const top = cropRows(canvas, 0, Math.min(height, center + margin))
  const bottom = cropRows(canvas, Math.max(0, center - margin), height)
  return [top, bottom]
}

/**
 * 세로 구간만 잘라 낸 캔버스. **가로는 자르지 않는다**.
 * @param canvas - 그려 둔 조각
 * @param from - 위쪽 경계(px)
 * @param to - 아래쪽 경계(px)
 * @returns 잘라 낸 캔버스
 */
function cropRows(canvas: HTMLCanvasElement, from: number, to: number): HTMLCanvasElement {
  const height = Math.max(1, to - from)
  const out = document.createElement('canvas')
  out.width = canvas.width
  out.height = height
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('이미지를 자를 수 없습니다.')
  // JPEG 는 투명을 모른다 — 안 칠하면 검게 나온다
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, height)
  ctx.drawImage(canvas, 0, from, canvas.width, height, 0, 0, canvas.width, height)
  return out
}
