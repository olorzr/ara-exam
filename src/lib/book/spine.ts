import { MM_TO_PX } from '@/lib/print/constants';
import { fitVerticalScale } from '@/lib/problem-paper/cover-scale';

/**
 * 책등(세네카)과 표지 펼침면의 치수 (순수 함수).
 *
 * ⚠️ 계산식은 열림인쇄 견적 화면(`/product/book/option/?product-type=D413`)의 프런트 코드와 **글자 그대로**
 *    같다(2026-10-25 확인) — 그래야 우리가 그린 책등 폭이 견적 화면의 '세네카' 값과 같다:
 *    `seneca = Math.round(((양면 ? 쪽/2 : 쪽) × 두께 + (양면 ? 0.5 : 1)) × 10) / 10`,
 *    `표지 작업 폭 = Math.ceil(재단 폭 × 2 + seneca + 6)`, `표지 작업 높이 = 재단 높이 + 6`.
 */

/** 재단 폭 — A4 */
export const TRIM_W_MM = 210;
/** 재단 높이 — A4 */
export const TRIM_H_MM = 297;
/** 재단 여백(사방) — 인쇄소 작업사이즈는 재단 사이즈에 사방 3mm 를 더한다 */
export const BLEED_MM = 3;
/**
 * 책등이 이보다 얇으면 글자를 찍지 않는다 — 재단 오차(±1mm 안팎)로 글자가 앞·뒤표지로 넘어간다.
 * A4 · 모조지 80g 이면 80쪽(4.1mm) 언저리가 경계다.
 */
export const MIN_SPINE_TEXT_MM = 4;

/**
 * 책등 폭 — 열림인쇄 견적 화면과 같은 식(파일 머리 주석).
 * @param pageCount - 내지 쪽 수(4의 배수로 채운 값)
 * @param thicknessMm - 내지 한 장 두께(mm)
 * @param doubleSided - 양면 인쇄인가(책은 늘 양면)
 * @returns 책등 폭(mm, 소수 한 자리)
 */
export function spineWidthMm(pageCount: number, thicknessMm: number, doubleSided = true): number {
  const sheets = doubleSided ? pageCount / 2 : pageCount;
  const allowance = doubleSided ? 0.5 : 1;
  return Math.round((sheets * thicknessMm + allowance) * 10) / 10;
}

/**
 * 쪽 수를 배수로 올린다(무선제본 내지는 4의 배수 — 인쇄소 요구). 엔진의 `padPagesTo` 와 같은 식이다.
 * @param pages - 쪽 수
 * @param multiple - 배수
 * @returns 올린 쪽 수(0 은 0)
 */
export function padPageCount(pages: number, multiple = 4): number {
  if (pages <= 0) return 0;
  return Math.ceil(pages / multiple) * multiple;
}

/** 표지 펼침면(뒷표지 · 책등 · 앞표지 한 장)의 치수(mm) */
export interface CoverSpreadGeometry {
  /** 작업 폭 = ceil(재단 폭 × 2 + 책등 + 6) — 견적 화면의 '표지 작업사이즈' 폭 */
  widthMm: number;
  /** 작업 높이 = 재단 높이 + 6 */
  heightMm: number;
  /** 바깥(왼쪽·오른쪽) 여백 — 3mm 에 ceil 로 생긴 나머지의 반씩을 더한 값 */
  outerBleedMm: number;
  /** 책등 왼쪽 끝 — 뒷표지(여백 포함)의 폭 */
  spineXMm: number;
  /** 앞표지 왼쪽 끝 */
  frontXMm: number;
  spineMm: number;
}

/**
 * 표지 펼침면 치수. ceil 로 생긴 나머지는 바깥 여백 양쪽에 반씩 나눈다 — 책등이 펼침면 한가운데 오고
 * 앞·뒤표지 재단 폭은 정확히 210mm 다.
 * @param spineMm - 책등 폭(mm)
 * @returns 치수
 */
export function coverSpreadGeometry(spineMm: number): CoverSpreadGeometry {
  const exact = TRIM_W_MM * 2 + spineMm + BLEED_MM * 2;
  const widthMm = Math.ceil(exact);
  const outerBleedMm = BLEED_MM + (widthMm - exact) / 2;
  const spineXMm = outerBleedMm + TRIM_W_MM;
  return {
    widthMm,
    heightMm: TRIM_H_MM + BLEED_MM * 2,
    outerBleedMm,
    spineXMm,
    frontXMm: spineXMm + spineMm,
    spineMm,
  };
}

/**
 * 책등 바탕색 위에 읽히는 글자색 — 흰 글자와 검은 글자 가운데 대비가 큰 쪽(WCAG 상대 휘도).
 * @param hex - 바탕색 `#rrggbb`
 * @returns `'#ffffff'` 또는 `'#111111'`
 */
export function spineInkFor(hex: string): string {
  const lum = relativeLuminance(hex);
  if (lum === null) return LIGHT_INK;
  const dark = relativeLuminance(DARK_INK) ?? 0;
  const contrastWhite = 1.05 / (lum + 0.05);
  const contrastDark = (lum + 0.05) / (dark + 0.05);
  return contrastWhite >= contrastDark ? LIGHT_INK : DARK_INK;
}

/** 책등 글자색 둘 */
const LIGHT_INK = '#ffffff';
const DARK_INK = '#111111';

/**
 * WCAG 상대 휘도.
 * @param hex - `#rrggbb`
 * @returns 0~1. 모양이 틀리면 null
 */
function relativeLuminance(hex: string): number | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return null;
  const lin = (h: string) => {
    const c = parseInt(h, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(m[1]) + 0.7152 * lin(m[2]) + 0.0722 * lin(m[3]);
}

/** 책등 글자 자리 — 위아래 여백(재단선 기준)과 좌우 여백 */
export const SPINE_PAD_Y_MM = 14;
export const SPINE_PAD_X_MM = 0.8;
/** 제목과 학원 이름 사이 */
export const SPINE_GAP_MM = 8;
/** 학원 이름 글자 크기 = 제목 기준 크기 × 이 값 */
export const SPINE_BRAND_RATIO = 0.7;
/** 학원 이름 글자 크기의 아래 끝(px) */
export const SPINE_BRAND_MIN_PX = 6;
/** 제목·학원 이름 자간(em)과 줄 높이 — book-cover.css 와 같은 값 */
export const SPINE_LETTER_SPACING = 0.08;
export const SPINE_BRAND_LETTER_SPACING = 0.15;
export const SPINE_LINE_HEIGHT = 1.15;

/** 책등 글자 크기(px) */
export interface SpineTypeSize {
  /** 제목 글자 크기 */
  titlePx: number;
  /** 학원 이름 글자 크기 */
  brandPx: number;
}

/**
 * 책등 글자 크기 — 책등 폭에 맞춘 기준 크기에서 출발해, 제목이 학원 이름과 함께 세로 자리에 다 들어가도록 줄인다
 * (`fitVerticalScale` — 잘라 내지 않는다, 표지 책등 디자인과 같은 규약).
 * 제목 글꼴마다 글자 몸 크기가 달라 `glyphScale`(글꼴의 `sizeScale`)을 제목 기준 크기에만 곱한다 — 곱한 크기로 자리를 재므로
 * 키워도 세로 자리를 넘지 않는다. 학원 이름은 늘 같은 글꼴이라 보정하지 않는다.
 * @param title - 책등 제목
 * @param brand - 아래쪽 학원 이름
 * @param spineMm - 책등 폭(mm)
 * @param glyphScale - 제목 글꼴의 글자 크기 보정(기본 1)
 * @returns 글자 크기
 */
export function spineTypeSize(title: string, brand: string, spineMm: number, glyphScale = 1): SpineTypeSize {
  const widthPx = Math.max(1, (spineMm - SPINE_PAD_X_MM * 2) * MM_TO_PX);
  const base = Math.min(30, Math.max(8, spineMm * MM_TO_PX * 0.5));
  // 학원 이름은 얇은 책등에서도 6px(≈4.5pt) 아래로 내리지 않는다 — 80쪽(4.1mm)에서 실제로 너무 작았다
  const brandPx = Math.max(SPINE_BRAND_MIN_PX, base * SPINE_BRAND_RATIO);
  const brandLen = [...brand].length;
  const brandHeight = brandLen * brandPx * (1 + SPINE_BRAND_LETTER_SPACING);
  const height = (TRIM_H_MM - SPINE_PAD_Y_MM * 2 - SPINE_GAP_MM) * MM_TO_PX - brandHeight;
  const titleBase = base * (glyphScale > 0 ? glyphScale : 1);
  const scale = fitVerticalScale(title, {
    height: Math.max(1, height),
    width: widthPx,
    fontSize: titleBase,
    letterSpacing: SPINE_LETTER_SPACING,
    lineHeight: SPINE_LINE_HEIGHT,
  });
  return { titlePx: Math.round(titleBase * scale * 10) / 10, brandPx: Math.round(brandPx * 10) / 10 };
}
