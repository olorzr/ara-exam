import { COVER_TITLE_SUFFIXES, type PaperCover } from './cover';
import { COVER_COPY } from './cover-copy';

/**
 * 디자인 표지의 글꼴 — 글꼴 CSS 는 globals.css 가 jsdelivr 의 @fontsource 에서 가져온다
 * (CSP `style-src`/`font-src` 가 그 CDN 만 연다).
 *
 * 한글 글꼴은 조각(unicode-range)이 백 개가 넘어 **그 글자가 처음 그려질 때** 조각을 받는다.
 * 그래서 인쇄 전에 `document.fonts.load(글꼴, 찍을 글자)` 로 조각을 미리 받는다(`useCoverFontsReady`).
 * ⚠️ 굵기를 바꾸거나 더하면 globals.css 의 @import 와 여기를 **함께** 고친다.
 */
export const COVER_FONT_SPECS: readonly string[] = [
  '400 1em "Noto Serif KR"',
  '900 1em "Noto Serif KR"',
  '400 1em "IBM Plex Sans KR"',
  '500 1em "IBM Plex Sans KR"',
  '700 1em "IBM Plex Sans KR"',
  '400 1em "IBM Plex Mono"',
  '400 1em "Instrument Serif"',
  'italic 400 1em "Instrument Serif"',
];

/** 글꼴을 이만큼 기다려도 안 오면 그냥 인쇄를 연다(fail-open — 모양만 대체 글꼴로 바뀐다) */
export const COVER_FONTS_TIMEOUT_MS = 8000;

/**
 * 표지에 찍힐 글자 전부 — 이 글자들이 든 조각만 미리 받는다. 제목은 적은 제목과 문제지 제목을 둘 다 담고
 * (적은 제목이 비면 문제지 제목을 쓴다) 교사용·답지 꼬리도 담는다.
 * @param cover - 표지
 * @param paperTitle - 문제지 제목
 * @param year - 문제지를 만든 해
 * @returns 이어 붙인 글
 */
export function coverFontSample(cover: PaperCover, paperTitle: string, year: string): string {
  return [
    cover.title, paperTitle, ...COVER_TITLE_SUFFIXES, cover.subtitle, year, '0123456789',
    ...Object.values(COVER_COPY),
  ].join(' ');
}
