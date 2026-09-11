'use client'

// 쪽이 2단 조판인지 알아내고 가운데 여백(단 사이 홈)의 자리를 찾는다 (브라우저 전용).
//
// **왜 단을 갈라 보내는가.** 국어 시험지는 거의 2단 조판인데, 쪽 전체를 한 장으로 보내면
// 시각 모델이 읽는 순서를 자주 틀린다 — 왼쪽 단 첫 줄 다음에 오른쪽 단 첫 줄을 읽어
// 두 글이 한 문단으로 섞인다. 단을 갈라 보내면 **읽을 순서가 하나뿐**이라 그 실수가 사라지고,
// 같은 바이트 예산이 절반의 넓이에 쓰여 글자당 화질도 올라간다.
//
// 홈을 못 찾으면 **가르지 않는다.** 초등 프린트·문제집에는 한 단으로 조판한 쪽이 섞여 있고,
// 그런 쪽을 반으로 자르면 모든 줄이 가운데서 두 동강 난다 — 못 갈라 손해 보는 것보다 훨씬 나쁘다.

/** 분석용 축소 크기. 홈은 큰 무늬라 이 정도면 충분하고, 축소가 잡티를 지워 오히려 안정적이다 */
const PROFILE_WIDTH = 400
const PROFILE_HEIGHT = 560

/** 이 밝기보다 어두우면 글자로 본다 (0~255). 스캔본의 누런 바탕을 글자로 세지 않을 만큼 낮다 */
const INK_LUMA = 190

/** 세로줄 하나가 '비어 있다' 고 볼 잉크 비율. 쪽 번호·머리글이 스치는 것을 견딘다 */
const BLANK_RATIO = 0.03

/** 홈을 찾을 구간 — 쪽 가운데에서 좌우로 이만큼 (폭 대비) */
const SEARCH_BAND = 0.15

/** 홈으로 인정할 최소 너비 (폭 대비). 글자 사이 공백을 홈으로 착각하지 않게 한다 */
const MIN_GUTTER = 0.012

/** 양쪽 단에 각각 이만큼은 글자가 있어야 2단이다 — 반쪽이 빈 쪽을 가르지 않는다 */
const MIN_SIDE_INK = 0.15

/** 머리글·꼬리글은 단을 가로질러 이어진다 — 위아래 이만큼은 세지 않는다 */
const MARGIN_ROWS = 0.08

/**
 * 세로줄별 잉크 비율에서 가운데 홈의 **중심**을 찾는다 (순수 함수).
 *
 * @param profile - 세로줄마다 0~1 의 잉크 비율 (왼쪽부터)
 * @returns 홈 중심의 자리(0~1). 2단이 아니면 null
 */
export function findGutter(profile: readonly number[]): number | null {
  const width = profile.length
  if (width < 20) return null

  const from = Math.floor(width * (0.5 - SEARCH_BAND))
  const to = Math.ceil(width * (0.5 + SEARCH_BAND))
  const minRun = Math.max(2, Math.round(width * MIN_GUTTER))

  // 구간 안에서 가장 긴 '빈 줄' 이 홈이다. 여럿이면 가장 넓은 것을 고른다
  let best: { start: number; end: number } | null = null
  let runStart = -1
  for (let x = from; x <= to; x += 1) {
    const blank = x < width && profile[x] <= BLANK_RATIO
    if (blank) {
      if (runStart < 0) runStart = x
      continue
    }
    if (runStart >= 0) {
      const run = { start: runStart, end: x - 1 }
      if (!best || run.end - run.start > best.end - best.start) best = run
      runStart = -1
    }
  }
  if (runStart >= 0) {
    const run = { start: runStart, end: Math.min(to, width - 1) }
    if (!best || run.end - run.start > best.end - best.start) best = run
  }

  if (!best || best.end - best.start + 1 < minRun) return null

  const center = Math.round((best.start + best.end) / 2)
  // 양쪽에 글자가 실제로 있어야 한다. 한쪽이 비었으면 1단 쪽의 오른쪽 여백을
  // 홈으로 본 것이다 — 그대로 자르면 본문이 통째로 한쪽으로 몰린다
  if (inkedFraction(profile, 0, center) < MIN_SIDE_INK) return null
  if (inkedFraction(profile, center + 1, width) < MIN_SIDE_INK) return null

  return center / width
}

/** 구간에서 글자가 있는 세로줄의 비율 */
function inkedFraction(profile: readonly number[], from: number, to: number): number {
  if (to <= from) return 0
  let inked = 0
  for (let x = from; x < to; x += 1) if (profile[x] > BLANK_RATIO) inked += 1
  return inked / (to - from)
}

/**
 * 캔버스에서 세로줄별 잉크 비율을 뽑는다.
 *
 * 작은 캔버스에 다시 그려서 읽는다 — 원본은 수백만 화소라 `getImageData` 가 무겁고,
 * 홈은 큰 무늬라 축소해도 그대로 보인다.
 * @param canvas - 쪽을 그린 캔버스
 * @returns 세로줄별 0~1 비율. 읽지 못하면 null
 */
export function inkProfile(canvas: HTMLCanvasElement): number[] | null {
  if (canvas.width < 10 || canvas.height < 10) return null
  const small = document.createElement('canvas')
  small.width = PROFILE_WIDTH
  small.height = PROFILE_HEIGHT
  const ctx = small.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  // 스캔본에 투명 화소가 있으면 검게 읽힌다 — 흰 바탕을 먼저 깐다
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, PROFILE_WIDTH, PROFILE_HEIGHT)
  ctx.drawImage(canvas, 0, 0, PROFILE_WIDTH, PROFILE_HEIGHT)

  let data: Uint8ClampedArray
  try {
    data = ctx.getImageData(0, 0, PROFILE_WIDTH, PROFILE_HEIGHT).data
  } catch {
    // 오염된 캔버스 등 — 못 읽으면 가르지 않는다
    return null
  }

  const top = Math.floor(PROFILE_HEIGHT * MARGIN_ROWS)
  const bottom = PROFILE_HEIGHT - top
  const rows = bottom - top
  const profile = new Array<number>(PROFILE_WIDTH).fill(0)

  for (let y = top; y < bottom; y += 1) {
    const rowStart = y * PROFILE_WIDTH * 4
    for (let x = 0; x < PROFILE_WIDTH; x += 1) {
      const i = rowStart + x * 4
      // 밝기만 본다 — 색 시험지도 글자는 어둡다
      const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      if (luma < INK_LUMA) profile[x] += 1
    }
  }
  for (let x = 0; x < PROFILE_WIDTH; x += 1) profile[x] /= rows
  return profile
}

/**
 * 이 쪽의 단 사이 홈이 어디인가.
 * @param canvas - 쪽을 그린 캔버스
 * @returns 홈 중심의 가로 자리(0~1). 1단이거나 못 알아보면 null
 */
export function detectGutter(canvas: HTMLCanvasElement): number | null {
  const profile = inkProfile(canvas)
  return profile ? findGutter(profile) : null
}
