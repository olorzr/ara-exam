import { COVER_COPY } from './cover-copy';
import { COVER_FIT_PAGE_H, COVER_ROOT_LH } from './cover-fit';
import {
  fitTextScale, fitVerticalScale, titleLengthOf, titleScale, wrappedLineCount,
  type TextBlock, type TitleScaleStep, type VerticalBox,
} from './cover-scale';
import type { CoverLayoutProps } from './cover-text';

/**
 * C 책등의 글 크기 (순수 함수) — 본문 제목·단원 목록, 세로 제목 책등 셋, 과정 상자. 자리 px 는 spines.css 와 같다.
 */

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
/** 머리 줄 높이(고정 글: 아라 · 아라국어논술 — 문제지 · 연도) */
const SPINES_HEAD_H = 70;
/** 정보 줄: 위 선 1px + 위 여백 14px · 12px(자간 0.02em) · 폭(학생 칸이 있으면 그만큼 좁다) */
const SPINES_INFO = { padTop: 15, fontSize: 12, tracking: 1.02, width: 714, widthWithField: 714 - 24 - 190 };
/** 본문(제목·단원) — 위 여백 54px · 폭 714px · 단원 목록 위 여백 14px · 책장과의 숨 10px.
 * 단원 이름 폭은 번호(≈30px)·간격(12px)을 빼고 자간 0.02em 만큼 줄인 값이다 */
export const SPINES_BODY = { marginTop: 54, width: 714, listGap: 14, breath: 10, topicWidth: (714 - 12 - 30) / 1.02 };
/** 과정 상자 책등(--4, 122×560): 위아래 여백 70px · 상자 안 여백 20/14px · 테두리 · 자간 0.02em */
const SPINES_LABEL = {
  width: (122 - 28 - 4) / 1.02, height: SPINE_MAX_H - 140 - 40 - 4, fontSize: 12, lineHeight: 1.4,
};
/** 본문 제목의 단계 — 64px 에서 11자 한 줄 */
export const SPINES_TITLE_STEPS: readonly TitleScaleStep[] = [
  { maxLength: 11, scale: 1 },
  { maxLength: 20, scale: 0.75 },
  { maxLength: 32, scale: 0.55 },
  { maxLength: Infinity, scale: 0.42 },
];
/** 단원 한 줄 — 이름 18px · 줄 높이 1.35(번호 24px 와 같은 높이) */
const SPINES_TOPIC = { fontSize: 18, lineHeight: 1.35 };

/**
 * 책등 정보 줄의 선생님 글 — 컴포넌트가 그리는 것과 같다.
 * @param teacher - 선생님 이름
 * @returns `선생님  송알` (이름이 없으면 '')
 */
export function spinesTeacherText(teacher: string): string {
  return teacher ? `${COVER_COPY.teacherLabel}  ${teacher}` : '';
}

/**
 * 책등의 과정 상자 줄 — 과정을 ` · ` 에서 나눈다(비면 시안처럼 아라 · 국어 · 논술).
 * @param course - 과정
 * @returns 상자 안 줄
 */
export function spinesCourseLines(course: string): string[] {
  return (course || COVER_COPY.spinesBox).split(/\s*·\s*/).filter(Boolean);
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
 * 머리·정보 줄의 높이 — 머리는 고정 글이고, 정보 줄은 선생님 이름이 길면 줄이 는다.
 * @param p - 표지 값
 * @returns 높이(px)
 */
export function spinesHeadInfoHeight(p: Pick<CoverLayoutProps, 'teacher' | 'showNameBox'>): number {
  const width = p.showNameBox ? SPINES_INFO.widthWithField : SPINES_INFO.width;
  const lines = Math.max(1, wrappedLineCount(spinesTeacherText(p.teacher), width / (SPINES_INFO.fontSize * SPINES_INFO.tracking)));
  return SPINES_HEAD_H + SPINES_INFO.padTop + lines * SPINES_INFO.fontSize * COVER_ROOT_LH;
}

/**
 * 본문(제목·단원 목록)이 차지해도 되는 높이 — 중철 면에서 가장 높은 책(560px)과 머리·정보 줄·여백을 뺀다.
 * @param p - 표지 값
 * @returns 높이(px)
 */
export function spinesBodyBudget(p: CoverLayoutProps): number {
  const listGap = p.topics.length > 0 ? SPINES_BODY.listGap : 0;
  return COVER_FIT_PAGE_H - SPINE_MAX_H - spinesHeadInfoHeight(p) - SPINES_BODY.marginTop - listGap - SPINES_BODY.breath;
}

/**
 * 책등 본문의 제목·단원 배율 — 둘을 **함께** 줄여 책장 위에 든다(따로 줄이면 합이 넘친다).
 * @param p - 표지 값
 * @returns 제목 배율(단계표 × 맞춤)과 단원 배율(맞춤)
 */
export function spinesBodyScale(p: CoverLayoutProps): { title: number; topic: number } {
  const pref = titleScale(titleLengthOf(p.title), SPINES_TITLE_STEPS);
  const blocks: TextBlock[] = [
    { text: p.title, fontSize: 64 * pref, lineHeight: 1, width: SPINES_BODY.width },
    ...p.topics.map((text) => ({
      text, fontSize: SPINES_TOPIC.fontSize, lineHeight: SPINES_TOPIC.lineHeight, width: SPINES_BODY.topicWidth,
    })),
  ];
  const k = fitTextScale(blocks, spinesBodyBudget(p), 2);
  return { title: pref * k, topic: k };
}
