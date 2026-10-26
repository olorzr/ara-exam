/**
 * 책등 제목 글꼴 — 원장님이 고른다(2026-10-26 "위의 폰트는 얼추 고를 수 있도록").
 *
 * 글꼴 CSS 는 globals.css 가 jsdelivr 에서 가져온다(CSP `style-src`/`font-src` 가 그 CDN 만 연다).
 * ⚠️ 글꼴·굵기를 더하거나 바꾸면 globals.css 의 @import 와 여기를 **함께** 고친다 — 한쪽만 고치면 화면은 대체 글꼴로
 *    그려지는데 아무 오류도 안 난다. 인쇄 전에 그 조각을 미리 받으므로(`spineFontSpec` → `useFontsReady`) 굵기도 같아야 한다.
 * 아래쪽 학원 이름은 고르지 않는다 — 학원 로고 글꼴(지마켓 산스 Bold)로 늘 고정이다(`SPINE_BRAND_FONT_SPEC`).
 */

/** 책등 제목 글꼴 이름표 */
export const SPINE_FONT_IDS = [
  'gmarket', 'pretendard', 'dohyeon', 'jua', 'dongle', 'gamja', 'yeonsung', 'notoserif', 'nanumpen',
] as const;

/** 책등 제목 글꼴 이름표 */
export type SpineFontId = (typeof SPINE_FONT_IDS)[number];

/** 책등 제목 글꼴 하나 */
export interface SpineFont {
  id: SpineFontId;
  /** 고르기 칸에 보이는 이름 */
  label: string;
  /** CSS `font-family` 의 첫 이름(따옴표 없이) — 글꼴 미리 받기 지정에도 쓴다 */
  family: string;
  /** 받아 둔 굵기 — globals.css 의 @import 굵기와 같다 */
  weight: number;
  /**
   * 글자 크기 보정 — 같은 글자 크기에서 글자 몸이 작게 그려지는 글꼴(손글씨·둥근 글꼴)을 키운다.
   * 2026-10-26 헤드리스 크롬에서 한글 글자 폭을 재서 지마켓 산스의 0.9 배쯤 되게 맞췄다(동글 0.59 · 나눔손글씨 펜 0.65 ·
   * 연성 0.76 · 감자꽃 0.80). 책등 글자 크기 맞춤(`spineTypeSize`)이 이 값을 곱한 크기로 자리를 재므로 넘치지 않는다.
   */
  sizeScale: number;
}

/** 고를 수 있는 책등 제목 글꼴 — 차례가 곧 고르기 칸의 차례다 */
export const SPINE_FONTS: readonly SpineFont[] = [
  { id: 'gmarket', label: '지마켓 산스', family: 'Gmarket Sans', weight: 700, sizeScale: 1 },
  { id: 'pretendard', label: '프리텐다드', family: 'Pretendard Variable', weight: 700, sizeScale: 1 },
  { id: 'dohyeon', label: '도현', family: 'Do Hyeon', weight: 400, sizeScale: 1 },
  { id: 'jua', label: '주아', family: 'Jua', weight: 400, sizeScale: 1 },
  { id: 'dongle', label: '동글', family: 'Dongle', weight: 700, sizeScale: 1.5 },
  { id: 'gamja', label: '감자꽃', family: 'Gamja Flower', weight: 400, sizeScale: 1.15 },
  { id: 'yeonsung', label: '연성', family: 'Yeon Sung', weight: 400, sizeScale: 1.15 },
  { id: 'notoserif', label: '노토 세리프', family: 'Noto Serif KR', weight: 900, sizeScale: 1 },
  { id: 'nanumpen', label: '나눔손글씨 펜', family: 'Nanum Pen Script', weight: 400, sizeScale: 1.35 },
];

/** 새 책의 책등 제목 글꼴 — 0.9.58 까지 쓰던 글꼴 그대로 */
export const DEFAULT_SPINE_FONT: SpineFontId = 'gmarket';

/** 학원 이름(로고) 글꼴 — 미리 받기 지정. book-cover.css 의 `.book-spine__brand`·`.book-cover__brand` 와 같다 */
export const SPINE_BRAND_FONT_SPEC = '700 1em "Gmarket Sans"';

/**
 * 알려진 책등 글꼴 이름표인가.
 * @param value - 검사할 값
 * @returns `SPINE_FONT_IDS` 의 하나면 true
 */
export function isSpineFontId(value: unknown): value is SpineFontId {
  return typeof value === 'string' && (SPINE_FONT_IDS as readonly string[]).includes(value);
}

/**
 * 이름표로 글꼴을 찾는다 — 모르는 값이면 기본 글꼴.
 * @param id - 이름표
 * @returns 글꼴
 */
export function spineFontOf(id: string): SpineFont {
  return SPINE_FONTS.find((f) => f.id === id) ?? SPINE_FONTS[0];
}

/**
 * 그릴 때 쓰는 `font-family` — 고른 글꼴 뒤에 대체 글꼴을 붙인다(조각이 늦게 와도 글자가 사라지지 않게).
 * @param font - 글꼴
 * @returns CSS 값
 */
export function spineFontFamily(font: SpineFont): string {
  return `"${font.family}", "Pretendard Variable", Pretendard, sans-serif`;
}

/**
 * 인쇄 전에 조각을 미리 받을 때 쓰는 지정(`document.fonts.load` 의 첫 인자).
 * @param font - 글꼴
 * @returns `'700 1em "Gmarket Sans"'` 꼴
 */
export function spineFontSpec(font: SpineFont): string {
  return `${font.weight} 1em "${font.family}"`;
}
