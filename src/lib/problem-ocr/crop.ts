import type { Bbox } from '@/types/problem-bank';
import type { OcrBox } from './schema';

/**
 * 모델이 알려 준 위치(단 + 세로 구간) → 실제 잘라 낼 사각형 (순수 함수).
 *
 * 좌표를 네 숫자로 받지 않는 이유는 schema.ts 에 적었다 — 시각 모델의 x/w 는 부정확하고,
 * 국어 시험지는 거의 2단 조판이라 **단 번호 + 세로 구간**이면 충분하다.
 * 가로는 그 단 전체를 쓴다.
 */

/** 위아래로 더 잡을 여유 (쪽 높이 비율). 글자 윗선·아랫선이 잘리는 걸 막는다 */
const MARGIN_FRAC = 0.015;

/**
 * 두 단 사이 여백의 절반 (쪽 폭 비율).
 * 단 경계를 정확히 반으로 자르면 이웃 단의 글자가 한 줄씩 딸려 온다.
 */
const GUTTER_FRAC = 0.02;

/**
 * 정규화 좌표를 픽셀 사각형으로 바꾼다.
 * @param box - 모델이 준 위치
 * @param width - 페이지 캔버스 폭(px)
 * @param height - 페이지 캔버스 높이(px)
 * @returns 잘라 낼 사각형(px, 정수). 캔버스 밖으로 나가지 않는다
 */
export function boxToPixelRect(
  box: OcrBox,
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number } {
  const norm = boxToBbox(box);
  const x = Math.round(norm.x * width);
  const y = Math.round(norm.y * height);
  return {
    x,
    y,
    // 반올림 뒤에도 캔버스를 넘지 않게 오른쪽·아래를 기준으로 폭을 다시 구한다
    w: Math.max(1, Math.min(width, Math.round((norm.x + norm.w) * width)) - x),
    h: Math.max(1, Math.min(height, Math.round((norm.y + norm.h) * height)) - y),
  };
}

/**
 * 모델 위치를 저장용 정규화 사각형으로 바꾼다.
 * DB 에는 이 값을 넣는다 — 나중에 다른 배율로 다시 그려도 같은 자리를 가리킨다.
 * @param box - 모델이 준 위치
 * @returns 0~1 범위의 사각형
 */
export function boxToBbox(box: OcrBox): Bbox {
  const top = Math.max(0, Math.min(box.top, box.bottom) - MARGIN_FRAC);
  const bottom = Math.min(1, Math.max(box.top, box.bottom) + MARGIN_FRAC);

  let x = 0;
  let w = 1;
  if (box.column === 1) {
    w = 0.5 - GUTTER_FRAC;
  } else if (box.column === 2) {
    x = 0.5 + GUTTER_FRAC;
    w = 0.5 - GUTTER_FRAC;
  }

  return { x, y: top, w, h: Math.max(0.01, bottom - top) };
}

/**
 * 저장된 정규화 사각형을 픽셀로 되돌린다(검수 화면의 오버레이·재크롭용).
 * @param bbox - 저장된 정규화 사각형
 * @param width - 캔버스 폭(px)
 * @param height - 캔버스 높이(px)
 * @returns 픽셀 사각형
 */
export function bboxToPixelRect(
  bbox: Bbox,
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number } {
  const x = Math.round(clamp01(bbox.x) * width);
  const y = Math.round(clamp01(bbox.y) * height);
  return {
    x,
    y,
    w: Math.max(1, Math.min(width, Math.round((clamp01(bbox.x) + clamp01(bbox.w)) * width)) - x),
    h: Math.max(1, Math.min(height, Math.round((clamp01(bbox.y) + clamp01(bbox.h)) * height)) - y),
  };
}

/**
 * 검수 화면에서 사람이 끌어 옮긴 사각형을 저장 형태로 되돌린다.
 * @param rect - 픽셀 사각형
 * @param width - 캔버스 폭(px)
 * @param height - 캔버스 높이(px)
 * @returns 0~1 범위로 가둔 사각형
 */
export function pixelRectToBbox(
  rect: { x: number; y: number; w: number; h: number },
  width: number,
  height: number,
): Bbox {
  if (width <= 0 || height <= 0) return { x: 0, y: 0, w: 1, h: 1 };
  const x = clamp01(rect.x / width);
  const y = clamp01(rect.y / height);
  return {
    x,
    y,
    w: clamp01(Math.max(rect.w, 1) / width) || 0.01,
    h: clamp01(Math.max(rect.h, 1) / height) || 0.01,
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(n, 0), 1);
}
