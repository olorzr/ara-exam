import { BOOKLET_SIDE_HEIGHT_PX } from '@/lib/print/constants';
import {
  fitTextScale, titleLengthOf, titleScale, TITLE_SCALE_STEPS, wrappedLineCount,
  type TextBlock, type TitleScaleStep,
} from './cover-scale';
import { brandLine, topicsLine, type CoverLayoutProps } from './cover-text';

/**
 * 디자인 표지마다 글 크기를 정한다 (순수 함수).
 *
 * 글 자리는 시안의 px 그대로 고정이라, 제목·단원이 길면 아래 꾸밈·바닥 글과 겹치거나 중철 면 밖으로 밀린다.
 * 그래서 디자인마다 **글이 들어갈 자리(px)** 를 적어 두고, 단계표로 고른 크기를 그 자리에 함께 들도록
 * 한 번 더 줄인다(`fitTextScale` — 실제 줄바꿈을 흉내 내 높이를 센다).
 * ⚠️ 여기 px 는 styles/paper-covers/*.css 와 같은 값이다 — CSS 를 바꾸면 함께 바꿀 것.
 * ⚠️ 높이는 늘 **중철 면**(A4 − 40px) 기준이다 — 낱장은 그보다 높아 늘 들어간다.
 * 책등은 cover-fit-spines.ts, 블러는 cover-fit-soft.ts, 라인드로잉은 cover-fit-zine.ts 에 있다(파일 300줄 규칙).
 */

/** 표지가 들어갈 가장 낮은 높이 */
export const COVER_FIT_PAGE_H = BOOKLET_SIDE_HEIGHT_PX;
/** 표지 뿌리의 줄 높이(base.css) — 따로 정하지 않은 글줄이 이 값을 쓴다 */
export const COVER_ROOT_LH = 1.3;
/** pt → px (96dpi) */
const PT = 96 / 72;

// ---- 간단(basic) — paper-cover.css: 여백 72/76/60, 머리 41px, 이름 칸 114px, 본문 사이 간격 42px ----
const BASIC_WIDTH = 641;
const BASIC_FIXED_H = 72 + 60 + 41 + 42 + 16;
const BASIC_NAMES_H = 114;

/** 글 덩어리와 그것이 넘지 말아야 할 높이 */
export interface CoverFitBudget {
  blocks: TextBlock[];
  height: number;
}

/**
 * 간단 표지에서 제목·부제가 함께 들어갈 자리.
 * @param p - 표지 값
 * @returns 글 덩어리(배율 1)와 높이
 */
export function basicCoverBudget(p: CoverLayoutProps): CoverFitBudget {
  const subtitle = [p.course, ...p.topics].filter(Boolean).join('\n');
  return {
    blocks: [
      { text: p.title, fontSize: 34 * PT, lineHeight: 1.3, width: BASIC_WIDTH },
      { text: subtitle, fontSize: 15 * PT, lineHeight: 1.5, width: BASIC_WIDTH },
    ],
    height: COVER_FIT_PAGE_H - BASIC_FIXED_H - (p.showNameBox ? BASIC_NAMES_H : 0),
  };
}

/**
 * 간단 표지의 제목·부제 배율 — 둘을 함께 줄인다(이름 칸을 종이 밖으로 밀지 않게, 코덱스 2R).
 * @param p - 표지 값
 * @returns 1 이하의 배율(보통은 1 — 예전 모양 그대로)
 */
export function basicCoverScale(p: CoverLayoutProps): number {
  const { blocks, height } = basicCoverBudget(p);
  return fitTextScale(blocks, height);
}

// ---- A 에디토리얼 — 제목 띠 360px(위 여백 40px) · 제목 폭 600px, 띠 안에 괄호 단원 줄 ----
/** 제목 띠에서 제목·괄호 단원 줄이 쓸 높이(띠 360px − 위 여백 40px) */
const EDITORIAL_BAND_ROOM = 360 - 40;
/** 제목 폭 — 시안처럼 '현대시 / 읽기' 두 줄로 갈리게 좁힌다(editorial.css `max-width`) */
export const EDITORIAL_TITLE_WIDTH = 600;
/** 괄호 단원 줄 — 위 여백 24px · 줄 높이 24px · 15px(자간 0.1em) · 폭(730px − 괄호 둘과 그 간격) */
const EDITORIAL_TOPICS = { gap: 24, lineH: 24, fontSize: 15, tracking: 1.1, width: 730 - 2 * (14 + 14) };

/**
 * 에디토리얼 괄호 단원 줄이 차지하는 높이.
 * @param topics - 단원
 * @returns 높이(px). 단원이 없으면 0
 */
export function editorialTopicsHeight(topics: readonly string[]): number {
  const line = topicsLine(topics);
  if (!line) return 0;
  const perLine = EDITORIAL_TOPICS.width / (EDITORIAL_TOPICS.fontSize * EDITORIAL_TOPICS.tracking);
  return EDITORIAL_TOPICS.gap + wrappedLineCount(line, perLine) * EDITORIAL_TOPICS.lineH;
}

/**
 * 에디토리얼 제목 배율 — 괄호 단원 줄이 늘면 그만큼 제목 자리가 준다.
 * @param p - 표지 값(제목·단원)
 * @returns 단계표 배율에 띠 맞춤을 곱한 값
 */
export function editorialTitleScale(p: Pick<CoverLayoutProps, 'title' | 'topics'>): number {
  const pref = titleScale(titleLengthOf(p.title), TITLE_SCALE_STEPS);
  const room = EDITORIAL_BAND_ROOM - editorialTopicsHeight(p.topics);
  return pref * fitTextScale([{ text: p.title, fontSize: 146 * pref, lineHeight: 0.92, width: EDITORIAL_TITLE_WIDTH }], room);
}

// ---- B 링 — 제목 56px · 폭 594px(줄 사이 빈 칸이 늘고 줄어 높이는 넉넉하다) ----
/** 링 제목의 단계 — 10자 한 줄, 100자 다섯 줄 */
export const RINGS_TITLE_STEPS: readonly TitleScaleStep[] = [
  { maxLength: 10, scale: 1 },
  { maxLength: 20, scale: 0.8 },
  { maxLength: 32, scale: 0.62 },
  { maxLength: Infinity, scale: 0.5 },
];
/** 링 글 줄기의 폭(794px − 좌우 여백 100px) — rings.css 의 `__flow` 와 같다 */
export const RINGS_TEXT_WIDTH = 594;
/** 제목 · × · 단원 줄이 함께 차지해도 되는 높이 — 나머지 줄과 빈 칸 몫을 남긴다 */
const RINGS_TITLE_H = 300;
/** × 줄(위 여백 6px + 26px) */
const RINGS_CROSS_H = 6 + 26;
/** 단원 줄 — 위 여백 6px · 22px × 1.3 · 자간 0.04em */
const RINGS_TOPICS = { gap: 6, fontSize: 22, lineHeight: 1.3, tracking: 1.04 };

/**
 * 링 제목·단원 줄 배율 — 둘을 **함께** 줄여 × 줄과 함께 300px 안에 둔다. 제목만 줄이면 단원이 아주 길 때
 * 단원 줄이 자리를 다 먹어 제목이 1px 까지 줄어든다(코덱스 2R, 2026-10-25).
 * @param p - 표지 값(제목·단원)
 * @returns 제목 배율(단계표 × 맞춤)과 단원 줄 배율(맞춤)
 */
export function ringsScales(p: Pick<CoverLayoutProps, 'title' | 'topics'>): { title: number; topic: number } {
  const line = topicsLine(p.topics);
  const pref = titleScale(titleLengthOf(p.title), RINGS_TITLE_STEPS);
  const blocks: TextBlock[] = [
    { text: p.title, fontSize: 56 * pref, lineHeight: 1.15, width: RINGS_TEXT_WIDTH },
    ...(line ? [{
      text: line, fontSize: RINGS_TOPICS.fontSize, lineHeight: RINGS_TOPICS.lineHeight,
      width: RINGS_TEXT_WIDTH / RINGS_TOPICS.tracking,
    }] : []),
  ];
  const room = RINGS_TITLE_H - RINGS_CROSS_H - (line ? RINGS_TOPICS.gap : 0);
  const k = fitTextScale(blocks, room);
  return { title: pref * k, topic: k };
}

// ---- E 스케치 — 윤곽선 제목 top 56px · 폭 700px, 그 아래 단원·태그라인·과정 줄, 선생님·학생 칸 top 470px ----
/** 스케치 제목의 단계 — 124px 에서 6자 한 줄 */
export const SKETCH_TITLE_STEPS: readonly TitleScaleStep[] = [
  { maxLength: 6, scale: 1 },
  { maxLength: 12, scale: 0.8 },
  { maxLength: 20, scale: 0.6 },
  { maxLength: Infinity, scale: 0.45 },
];
/** 머리 글 묶음의 위·폭, 아래 선생님·학생 칸의 위(sketch.css) */
export const SKETCH_HEAD = { top: 56, width: 700, gridTop: 470 };
/** 제목 아래 묶음 — 위 여백 65 · 단원 20px(자간 .02em) · 태그라인 위 12 + 24 · 과정 줄 위 34 · mono 11px(자간 .08em) */
const SKETCH_SUB = {
  padTop: 65, topicSize: 20, topicTracking: 1.02, taglineH: 12 + 24, kickerGap: 34, kickerSize: 11, kickerTracking: 1.08,
};
/** 머리 글 묶음과 선생님·학생 칸 사이의 숨 */
export const SKETCH_BREATH = 16;
/** 제목 자간 −0.05em — 글자 하나가 0.95em 이라 한 줄에 그만큼 더 든다(sketch.css) */
const SKETCH_TITLE_TRACKING = 0.95;

/**
 * 스케치 제목 아래 과정 줄 — 컴포넌트가 그리는 것과 같은 글이다(높이를 같은 글로 잰다).
 * @param p - 표지 값(과정·연도)
 * @returns `아라국어논술 · 과정 · 2026`
 */
export function sketchKicker(p: Pick<CoverLayoutProps, 'course' | 'year'>): string {
  return brandLine(p.course, p.year);
}

/** 제목 아래 묶음의 고정 높이 — 위 여백 · 태그라인(위 12 + 24) · 과정 줄 위 여백 */
const SKETCH_SUB_FIXED = SKETCH_SUB.padTop + SKETCH_SUB.taglineH + SKETCH_SUB.kickerGap;
/** 묶음 글의 폭(머리 폭 − 왼쪽 들여쓰기 6px) */
const SKETCH_SUB_WIDTH = SKETCH_HEAD.width - 6;

/**
 * 스케치 머리 글(제목 · 단원 줄 · 과정 줄)의 배율 — 셋을 **함께** 줄여 선생님·학생 칸(470px) 위에 둔다.
 * 제목만 줄이면 단원이 아주 길 때 제목이 바닥까지 줄어도 아래 묶음이 칸에 닿는다(코덱스 1R, 2026-10-25).
 * @param p - 표지 값
 * @returns 제목 배율(단계표 × 맞춤)과 단원·과정 줄 배율(맞춤)
 */
export function sketchHeadScales(p: Pick<CoverLayoutProps, 'title' | 'topics' | 'course' | 'year'>): { title: number; sub: number } {
  const pref = titleScale(titleLengthOf(p.title), SKETCH_TITLE_STEPS);
  const line = topicsLine(p.topics);
  const blocks: TextBlock[] = [
    { text: p.title, fontSize: 124 * pref, lineHeight: 1.04, width: SKETCH_HEAD.width / SKETCH_TITLE_TRACKING },
    ...(line ? [{
      text: line, fontSize: SKETCH_SUB.topicSize, lineHeight: COVER_ROOT_LH, width: SKETCH_SUB_WIDTH / SKETCH_SUB.topicTracking,
    }] : []),
    {
      text: sketchKicker(p), fontSize: SKETCH_SUB.kickerSize, lineHeight: COVER_ROOT_LH,
      width: SKETCH_SUB_WIDTH / SKETCH_SUB.kickerTracking,
    },
  ];
  const room = SKETCH_HEAD.gridTop - SKETCH_HEAD.top - SKETCH_SUB_FIXED - SKETCH_BREATH;
  const k = fitTextScale(blocks, room);
  return { title: pref * k, sub: k };
}

/**
 * 스케치 머리 글이 차지하는 높이 — 그 배율로 찍었을 때(테스트·검사가 자리 안인지 본다).
 * @param p - 표지 값
 * @returns 높이(px)
 */
export function sketchHeadHeight(p: Pick<CoverLayoutProps, 'title' | 'topics' | 'course' | 'year'>): number {
  const { title, sub } = sketchHeadScales(p);
  const line = topicsLine(p.topics);
  const size = (base: number, k: number) => base * k;
  const lines = (text: string, fontSize: number, width: number) => wrappedLineCount(text, width / fontSize);
  const titleSize = size(124, title);
  const topicSize = size(SKETCH_SUB.topicSize, sub);
  const kickerSize = size(SKETCH_SUB.kickerSize, sub);
  return lines(p.title, titleSize, SKETCH_HEAD.width / SKETCH_TITLE_TRACKING) * titleSize * 1.04
    + (line ? lines(line, topicSize, SKETCH_SUB_WIDTH / SKETCH_SUB.topicTracking) * topicSize * COVER_ROOT_LH : 0)
    + lines(sketchKicker(p), kickerSize, SKETCH_SUB_WIDTH / SKETCH_SUB.kickerTracking) * kickerSize * COVER_ROOT_LH
    + SKETCH_SUB_FIXED;
}
