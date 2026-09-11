'use client'

// 이미지 예산과 인코딩 — **쪽 렌더(pdfPages)와 단 가르기(pdfColumns)가 함께 쓰는 바닥**.
//
// ⚠️ 이 파일을 따로 둔 까닭이 사고 하나다. 예산값이 `pdfPages` 에 있고 `pdfColumns` 가
//    그것을 import 하는데, `pdfPages` 도 `pdfColumns` 를 import 해서 **순환**이 됐다.
//    번들러가 CommonJS 로 풀면 `pdfColumns` 가 초기화될 때 `pdfPages` 는 아직 상수를
//    선언하기 전이라 값이 `undefined` 가 되고, `undefined / 2 = NaN` 이 단 이미지 예산이
//    된다. 그러면 `url.length <= NaN` 이 늘 거짓이라 **모든 2단 쪽이 '너무 커서 건너뜀'**
//    으로 빠지고 읽기가 통째로 실패한다. 테스트(Vite/ESM)에서는 순서가 달라 안 잡혔다.
//    **여기 있는 값을 쓰는 쪽으로만 흐르게 두고, 되돌리지 말 것.**

/**
 * 장당 data URL 예산 = 묶음 예산 ÷ 묶음당 쪽수.
 * 인코딩이 **모든 쪽을 이 아래로 보장**하므로 묶음 총량은 구성상 항상 예산 안이다.
 * 덕분에 묶음 수를 렌더 전에 알 수 있고(= 진행률·사전 안내가 정확해진다), 바이트 그리디가 필요 없다.
 */
export const MAX_PAGE_BYTES = 1_200_000

/** 묶음 총량 2차 안전판. 통과가 확인된 3.2MB의 약 2배 */
export const MAX_BATCH_BYTES = 6_000_000

/** 쪽 전체를 그릴 배율 */
export const PAGE_SCALE = 2

/**
 * 단 하나짜리 이미지의 예산.
 *
 * 쪽 예산의 **절반**이다 — 2단 쪽을 갈라 보내도 그 쪽이 쓰는 총 바이트가 예전과 같아야
 * 묶음 총량과 진행률 계산이 흔들리지 않는다. 넓이도 절반이라 글자당 화질은 그대로다.
 */
export const MAX_COLUMN_BYTES = MAX_PAGE_BYTES / 2

/**
 * 단을 갈라 보낼 때의 배율.
 *
 * 더 크게 그리는 이유: 인코딩 사다리의 `maxSide` 가 **긴 변(세로)** 에 걸리는데,
 * 단 이미지는 세로가 쪽 전체와 같고 가로만 절반이다. 배율을 올리면 세로는 사다리가
 * 되돌리고 **가로 화소만 남는다** — A4 기준 단 하나가 595px 에서 892px 로 넓어진다.
 */
export const COLUMN_SCALE = 3

/** 단을 자를 때 안쪽으로 더 잡는 여유 (폭 대비). 경계에 걸친 글자가 잘리지 않게 한다 */
export const COLUMN_OVERLAP = 0.01

/** 인코딩 사다리 한 칸 */
export interface EncodeStep {
  maxSide: number;
  quality: number;
}

/**
 * 인코딩 사다리 — 위에서부터 시도해 **처음으로 예산에 맞는 것**을 쓴다.
 *
 * 1단은 기존 값 그대로다(화질 우선). 정답표 숫자를 잘못 읽으면 그 문항이 응시자 전원 오답으로
 * 처리되므로, 화질은 예산을 못 맞출 때만 양보한다.
 * A4(595×842pt)를 scale 2로 그리면 1190×1684라 1단에서는 축소가 걸리지 않는다 —
 * 실제 축소는 2단부터, 그리고 A3·큰 스캔 박스 PDF에서만 일어난다.
 */
export const ENCODE_STEPS: EncodeStep[] = [
  { maxSide: 1800, quality: 0.85 },
  { maxSide: 1600, quality: 0.75 },
  { maxSide: 1400, quality: 0.68 },
  { maxSide: 1200, quality: 0.60 },
]

/**
 * 단 이미지 전용 인코딩 사다리.
 *
 * 1단의 `maxSide` 가 쪽 사다리(1800)보다 큰 이유는 위 `COLUMN_SCALE` 주석과 같다 —
 * 1800 을 그대로 쓰면 애써 키운 가로 화소를 세로에 걸린 상한이 도로 깎는다.
 */
export const COLUMN_ENCODE_STEPS: EncodeStep[] = [
  { maxSide: 2600, quality: 0.82 },
  { maxSide: 2200, quality: 0.76 },
  { maxSide: 1800, quality: 0.70 },
  { maxSide: 1500, quality: 0.60 },
]

/** 긴 변이 maxSide 를 넘으면 비율 유지 축소 후 JPEG data URL */
export function encodeAt(canvas: HTMLCanvasElement, maxSide: number, quality: number): string {
  const scale = Math.min(1, maxSide / Math.max(canvas.width, canvas.height))
  if (scale >= 1) return canvas.toDataURL('image/jpeg', quality)
  const out = document.createElement('canvas')
  out.width = Math.max(1, Math.round(canvas.width * scale))
  out.height = Math.max(1, Math.round(canvas.height * scale))
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('이미지를 변환할 수 없습니다.')
  ctx.drawImage(canvas, 0, 0, out.width, out.height)
  return out.toDataURL('image/jpeg', quality)
}

/**
 * 예산에 맞을 때까지 화질을 낮춰가며 재인코딩. 끝까지 못 맞추면 **null**(호출부가 그 쪽을 건너뛴다).
 *
 * ⚠️ throw 하지 않는 게 핵심이다. 예전엔 한 장이 크면 실행 전체가 죽으면서
 *    "페이지 이미지가 너무 커요. 페이지 수를 줄여주세요."라는, 원인과 무관한 안내를 띄웠다
 *    (문제는 장수가 아니라 그 한 장이었다).
 * ⚠️ 재인코딩은 **같은 캔버스를 재사용**한다. pdf.js 재렌더는 비용이 10배다.
 * ⚠️ `budget` 이 숫자가 아니면(순환 import 사고) 모든 비교가 거짓이 되어 **늘 null** 이
 *    나온다 — 그 자리를 여기서 막는다. 조용히 모든 쪽을 건너뛰는 것보다 낫다.
 */
export function encodeWithinBudget(
  canvas: HTMLCanvasElement,
  budget: number,
  steps: EncodeStep[] = ENCODE_STEPS,
): string | null {
  if (!Number.isFinite(budget) || budget <= 0) {
    throw new Error(`이미지 예산이 잘못됐습니다 (${budget}).`)
  }
  for (const step of steps) {
    const url = encodeAt(canvas, step.maxSide, step.quality)
    // 바이트 비교 단위는 base64 문자 수다(실제 JPEG의 약 1.37배). ws로 나가는 것도 이 문자열이다.
    if (url.length <= budget) return url
  }
  return null
}
