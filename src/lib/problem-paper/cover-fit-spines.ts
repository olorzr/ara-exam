import { COVER_COPY } from './cover-copy';
import { COVER_FIT_PAGE_H, COVER_ROOT_LH } from './cover-fit';
import {
  FIT_SCALE_STEP, MIN_FIT_SCALE, fitScale, fitTextScale, fitVerticalScale, wrappedLineCount, type VerticalBox,
} from './cover-scale';
import type { CoverLayoutProps } from './cover-text';

/**
 * C 책등의 글 크기 (순수 함수) — 세로 제목 책등 셋, 과정 상자, 단원 목록. 자리 px 는 spines.css 와 같다.
 */

// ---- C 책등 — 세로 제목 책등 셋(spines.css 의 --1·--2·--6), 단원 목록 390×320px ----
/** 제목 책등 셋의 글 칸(책 크기에서 테두리·위아래 여백을 뺐다) */
export const SPINE_TITLE_BOXES = {
  thin: { height: 518, width: 48, fontSize: 22, letterSpacing: 0.3, lineHeight: 1.15 },
  bold: { height: 428, width: 74, fontSize: 60, letterSpacing: 0.35, lineHeight: 1.05 },
  wide: { height: 458, width: 86, fontSize: 44, letterSpacing: 0.1, lineHeight: 1.05 },
} satisfies Record<string, VerticalBox>;

/**
 * 책등 셋의 제목 배율.
 * @param title - 제목
 * @returns 책등마다 배율
 */
export function spinesTitleScales(title: string): Record<keyof typeof SPINE_TITLE_BOXES, number> {
  return {
    thin: fitVerticalScale(title, SPINE_TITLE_BOXES.thin),
    bold: fitVerticalScale(title, SPINE_TITLE_BOXES.bold),
    wide: fitVerticalScale(title, SPINE_TITLE_BOXES.wide),
  };
}

/** 가장 높은 책(spines.css 의 --1 · --4) — 책장은 이만큼은 늘 남긴다 */
const SPINE_MAX_H = 560;
/** 머리 줄: 위 여백 28px · 최소 높이 70px · 가운데 칸 폭(714px − 양끝 글 · 간격) · mono 11px(자간 0.04em) */
const SPINES_HEAD = { padTop: 28, minH: 70, width: 625, fontSize: 11, tracking: 1.04 };
/** 정보 줄: 위 선 1px + 위 여백 14px · 12px(자간 0.02em) · 폭(이름·날짜 칸이 있으면 그만큼 좁다) */
const SPINES_INFO = { padTop: 15, fontSize: 12, tracking: 1.02, width: 714, widthWithFields: 392 };
/** 단원 목록 위 여백 + 책장과의 숨 */
const SPINES_LIST_MARGIN = 60 + 10;
/** 과정 상자 책등(--4, 122×560): 위아래 여백 70px · 상자 안 여백 20/14px · 테두리 */
const SPINES_LABEL = { width: 122 - 28 - 4, height: SPINE_MAX_H - 140 - 40 - 4, fontSize: 12, lineHeight: 1.4 };

/**
 * 책등의 과정 상자 줄 — 과정을 ` · ` 에서 나눈다(비면 '국어 · 논술').
 * @param course - 과정
 * @returns 상자 안 줄
 */
export function spinesCourseLines(course: string): string[] {
  return (course || COVER_COPY.subject).split(/\s*·\s*/).filter(Boolean);
}

/**
 * 과정 상자 배율 — 조각이 많거나 길면 상자가 책 높이를 넘어 잘린다(코덱스 3R).
 * @param lines - `spinesCourseLines`
 * @returns 배율
 */
export function spinesCourseScale(lines: readonly string[]): number {
  return fitTextScale([{ text: lines.join('\n'), fontSize: SPINES_LABEL.fontSize, lineHeight: SPINES_LABEL.lineHeight,
    width: SPINES_LABEL.width }], SPINES_LABEL.height);
}

/**
 * 머리·정보 줄이 차지해도 되는 높이 — 보통(머리 70px + 정보 한두 줄 ≈ 100px)은 그대로 두고, 제목·과정이 아주 길어
 * 이 높이를 넘으면 두 줄의 글자를 함께 줄인다. 안 줄이면 목록 자리가 바닥나고 책장이 눌린다(코덱스 6R).
 */
const SPINES_HEAD_INFO_MAX = 180;

function spinesHeadInfoHeight(p: CoverLayoutProps, scale: number): number {
  const headText = `${p.title} — ${COVER_COPY.sheet}`;
  const headSize = SPINES_HEAD.fontSize * scale;
  const headLines = wrappedLineCount(headText, SPINES_HEAD.width / (headSize * SPINES_HEAD.tracking));
  const head = Math.max(SPINES_HEAD.minH, SPINES_HEAD.padTop + headLines * headSize * COVER_ROOT_LH);
  const infoText = p.course ? `${COVER_COPY.brandKo} · ${p.course}` : COVER_COPY.brandKo;
  const infoWidth = p.showNameBox ? SPINES_INFO.widthWithFields : SPINES_INFO.width;
  const infoSize = SPINES_INFO.fontSize * scale;
  const infoLines = wrappedLineCount(infoText, infoWidth / (infoSize * SPINES_INFO.tracking));
  return head + SPINES_INFO.padTop + infoLines * infoSize * COVER_ROOT_LH;
}

/**
 * 책등 머리·정보 줄의 글 배율 — 둘의 높이가 `SPINES_HEAD_INFO_MAX` 안에 들게.
 * @param p - 표지 값
 * @returns 배율(보통 1)
 */
export function spinesHeadScale(p: CoverLayoutProps): number {
  return fitScale((s) => spinesHeadInfoHeight(p, s) <= SPINES_HEAD_INFO_MAX, MIN_FIT_SCALE, FIT_SCALE_STEP);
}

/**
 * 단원 목록이 차지해도 되는 높이 — 중철 면에서 가장 높은 책(560px)을 남기고, 머리·정보 줄이 **실제로 차지하는
 * 높이**(긴 제목·과정은 줄이 는다, 코덱스 3R — 상한이 있다, 6R)와 위 여백을 뺀다. 늘 270px 넘게 남는다.
 * @param p - 표지 값
 * @returns 높이(px)
 */
export function spinesListBudget(p: CoverLayoutProps): number {
  return COVER_FIT_PAGE_H - SPINE_MAX_H - spinesHeadInfoHeight(p, spinesHeadScale(p)) - SPINES_LIST_MARGIN;
}

/**
 * 책등의 단원 목록 배율 — 이름 칸 폭(440px − 번호) × `spinesListBudget`.
 * @param p - 표지 값
 * @returns 배율
 */
export function spinesTopicScale(p: CoverLayoutProps): number {
  return fitTextScale(
    p.topics.map((text) => ({ text, fontSize: 25, lineHeight: 1.15, width: 390 })), spinesListBudget(p), 2,
  );
}

