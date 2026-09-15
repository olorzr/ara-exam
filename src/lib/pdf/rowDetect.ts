'use client'

// 쪽(또는 단) 하나를 위·아래로 가를 **빈 줄**을 찾는다 (브라우저 전용).
//
// **왜 가르는가.** 단 가르기(columnDetect.ts)와 같은 이유 하나 더다 — *글자가 몇 화소로
// 보이는가*. 비전 모델은 받은 이미지를 자기 상한에 맞춰 **도로 줄여서** 본다. 그래서
// 사다리의 `maxSide` 를 올려 통째로 크게 보내 봐야 글자는 커지지 않는다(파일만 커진다).
// 한 장에 담는 **글의 양을 줄이는 것**만이 글자를 크게 만든다:
//
//   1단 A4 쪽을 통째로  → 10pt 글자가 대략 13px
//   같은 쪽을 위/아래로 → 대략 18px  (+40%)
//
// 2단 쪽은 단 가르기가 이미 그 일을 하므로(가로가 절반) 단을 또 가르는 이득은 훨씬 작다 —
// 그래서 기본은 **1단 쪽만** 가른다(`PRINT_SPLIT_COLUMN_ROWS`).
//
// ⚠️ **빈 줄에서만 자른다.** 글줄 한가운데를 자르면 그 줄이 두 장에 반씩 걸려 획이 잘린다.
//    빈 줄을 못 찾으면 **가르지 않는다** — 못 갈라 손해 보는 쪽이 훨씬 낫다(단 가르기와 같은 규약).
// ⚠️ **기출(problem-ocr)은 세로를 절대 자르지 않는다.** 모델이 주는 `top`·`bottom` 이
//    쪽 기준이어야 그림·문항 크롭이 맞는다. 이 파일은 프린트 읽기만 쓴다.

/** 분석용 축소 크기. 가로는 '잉크가 있나' 만 보면 되므로 거칠게, 세로는 곱게 */
const PROFILE_COLS = 200
/**
 * ⚠️ 세로를 곱게 잡는 까닭: 216dpi 로 그린 A4(2526px)의 **줄 사이 틈이 10~15px** 인데,
 * 세로를 이보다 성기게 줄이면 그 틈이 축소 과정에서 메워져 **빈 줄이 하나도 안 보인다**.
 */
const PROFILE_ROWS = 1000

/** 이 밝기보다 어두우면 글자로 본다 (0~255). 가로 평균이 획을 옅게 만들어 단 감지보다 조금 관대하다 */
const INK_LUMA = 200

/** 가로줄 하나가 '비어 있다' 고 볼 잉크 비율. 스캔 티끌·점선을 견딘다 */
const BLANK_RATIO = 0.01

/** 스캐너 검은 테두리·펀치 구멍·세로 괘선은 좌우 끝에 있다 — 이만큼은 세지 않는다 */
const MARGIN_COLS = 0.06

/** 틈을 찾을 구간 — 쪽 가운데에서 위아래로 이만큼 (높이 대비) */
const SEARCH_BAND = 0.20

/**
 * 틈으로 인정할 최소 높이 (높이 대비). ≈10px@2526 — **글줄 사이 틈도 받는다**.
 * 빈 줄이기만 하면 어디서 잘라도 글자는 다치지 않기 때문이다.
 */
const MIN_ROW_GAP = 0.004

/** 위·아래 각각 이만큼은 글자가 있어야 가른다 — 아래가 빈 쪽을 굳이 가르지 않는다 */
const MIN_SIDE_INK = 0.15

/**
 * 자를 때 서로 더 잡는 여유 (높이 대비). ≈4px.
 *
 * ⚠️ **`MIN_ROW_GAP` 의 절반 아래여야 한다.** 그래야 겹친 부분이 빈 틈 **안에** 머물러
 *    같은 글줄이 두 장에 나오지 않는다(나오면 모델이 그 줄을 두 번 옮긴다).
 */
export const ROW_OVERLAP = 0.0015

/**
 * 가로줄별 잉크 비율에서 가를 빈 줄의 **중심**을 찾는다 (순수 함수).
 *
 * @param profile - 가로줄마다 0~1 의 잉크 비율 (위에서부터)
 * @returns 틈 중심의 자리(0~1). 가를 수 없으면 null
 */
export function findRowGap(profile: readonly number[]): number | null {
  const height = profile.length
  if (height < 20) return null

  const from = Math.floor(height * (0.5 - SEARCH_BAND))
  const to = Math.ceil(height * (0.5 + SEARCH_BAND))
  const minRun = Math.max(2, Math.round(height * MIN_ROW_GAP))
  const middle = (from + to) / 2

  // 구간 안에서 가장 **넓은** 빈 줄을 고른다(연 사이·문단 사이가 글줄 사이보다 넓다).
  // 같은 넓이면 가운데에 가까운 쪽 — 반반에 가까워야 두 장의 글 양이 비슷하다
  let best: { start: number; end: number } | null = null
  const consider = (run: { start: number; end: number }) => {
    if (!best) { best = run; return }
    const width = run.end - run.start
    const bestWidth = best.end - best.start
    if (width > bestWidth) { best = run; return }
    if (width < bestWidth) return
    const center = (run.start + run.end) / 2
    const bestCenter = (best.start + best.end) / 2
    if (Math.abs(center - middle) < Math.abs(bestCenter - middle)) best = run
  }

  let runStart = -1
  for (let y = from; y <= to; y += 1) {
    const blank = y < height && profile[y] <= BLANK_RATIO
    if (blank) {
      if (runStart < 0) runStart = y
      continue
    }
    if (runStart >= 0) {
      consider({ start: runStart, end: y - 1 })
      runStart = -1
    }
  }
  if (runStart >= 0) consider({ start: runStart, end: Math.min(to, height - 1) })

  if (!best) return null
  const run: { start: number; end: number } = best
  if (run.end - run.start + 1 < minRun) return null

  const center = Math.round((run.start + run.end) / 2)
  // 위아래에 실제로 글이 있어야 한다. 아래가 비었으면 본문이 끝난 자리를 틈으로 본 것이다 —
  // 그대로 자르면 글자 없는 반쪽 한 장을 괜히 보내게 된다
  if (inkedFraction(profile, 0, center) < MIN_SIDE_INK) return null
  if (inkedFraction(profile, center + 1, height) < MIN_SIDE_INK) return null

  return center / height
}

/** 구간에서 글자가 있는 가로줄의 비율 */
function inkedFraction(profile: readonly number[], from: number, to: number): number {
  if (to <= from) return 0
  let inked = 0
  for (let y = from; y < to; y += 1) if (profile[y] > BLANK_RATIO) inked += 1
  return inked / (to - from)
}

/**
 * 캔버스에서 가로줄별 잉크 비율을 뽑는다.
 *
 * 작은 캔버스에 다시 그려서 읽는다 — 원본은 수백만 화소라 `getImageData` 가 무겁다
 * (columnDetect.inkProfile 과 같은 규약).
 * @param canvas - 쪽 또는 단을 그린 캔버스
 * @returns 가로줄별 0~1 비율. 읽지 못하면 null
 */
export function rowInkProfile(canvas: HTMLCanvasElement): number[] | null {
  if (canvas.width < 10 || canvas.height < 10) return null
  const small = document.createElement('canvas')
  small.width = PROFILE_COLS
  small.height = PROFILE_ROWS
  const ctx = small.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  // 스캔본에 투명 화소가 있으면 검게 읽힌다 — 흰 바탕을 먼저 깐다
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, PROFILE_COLS, PROFILE_ROWS)
  ctx.drawImage(canvas, 0, 0, PROFILE_COLS, PROFILE_ROWS)

  let data: Uint8ClampedArray
  try {
    data = ctx.getImageData(0, 0, PROFILE_COLS, PROFILE_ROWS).data
  } catch {
    // 오염된 캔버스 등 — 못 읽으면 가르지 않는다
    return null
  }

  const left = Math.floor(PROFILE_COLS * MARGIN_COLS)
  const right = PROFILE_COLS - left
  const cols = right - left
  const profile = new Array<number>(PROFILE_ROWS).fill(0)

  for (let y = 0; y < PROFILE_ROWS; y += 1) {
    const rowStart = y * PROFILE_COLS * 4
    let inked = 0
    for (let x = left; x < right; x += 1) {
      const i = rowStart + x * 4
      // 밝기만 본다 — 색 프린트도 글자는 어둡다
      const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      if (luma < INK_LUMA) inked += 1
    }
    profile[y] = inked / cols
  }
  return profile
}

/**
 * 이 조각을 위·아래로 가를 자리가 어디인가.
 * @param canvas - 쪽 또는 단을 그린 캔버스
 * @returns 틈 중심의 세로 자리(0~1). 가를 수 없으면 null
 */
export function detectRowGap(canvas: HTMLCanvasElement): number | null {
  const profile = rowInkProfile(canvas)
  return profile ? findRowGap(profile) : null
}
