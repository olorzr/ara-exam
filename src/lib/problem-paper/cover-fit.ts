import { BOOKLET_SIDE_HEIGHT_PX } from '@/lib/print/constants';
import { COVER_COPY } from './cover-copy';
import {
  fitTextScale, titleLengthOf, titleScale, TITLE_SCALE_STEPS, wrappedLineCount,
  type TextBlock, type TitleScaleStep,
} from './cover-scale';
import type { CoverLayoutProps } from './cover-text';

/**
 * 디자인 표지마다 글 크기를 정한다 (순수 함수).
 *
 * 글 자리는 시안의 px 그대로 고정이라, 제목·단원이 길면 아래 꾸밈·바닥 글과 겹치거나 중철 면 밖으로 밀린다.
 * 그래서 디자인마다 **글이 들어갈 자리(px)** 를 적어 두고, 단계표로 고른 크기를 그 자리에 함께 들도록
 * 한 번 더 줄인다(`fitTextScale` — 실제 줄바꿈을 흉내 내 높이를 센다).
 * ⚠️ 여기 px 는 styles/paper-covers/*.css 와 같은 값이다 — CSS 를 바꾸면 함께 바꿀 것.
 * ⚠️ 높이는 늘 **중철 면**(A4 − 40px) 기준이다 — 낱장은 그보다 높아 늘 들어간다.
 * 책등은 cover-fit-spines.ts, 블러는 cover-fit-soft.ts 에 있다(파일 300줄 규칙).
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

// ---- A 에디토리얼 — 제목 띠 330px(위 여백 40px) · 폭 730px ----
/**
 * 에디토리얼 제목 배율.
 * @param title - 제목
 * @returns 단계표 배율에 띠 맞춤을 곱한 값
 */
export function editorialTitleScale(title: string): number {
  const pref = titleScale(titleLengthOf(title), TITLE_SCALE_STEPS);
  return pref * fitTextScale([{ text: title, fontSize: 146 * pref, lineHeight: 0.92, width: 730 }], 290);
}

// ---- B 링 — 제목 52px · 폭 600px(줄 사이 빈 칸이 늘고 줄어 높이는 넉넉하다) ----
/** 링 제목의 단계 — 12자 한 줄, 100자 다섯 줄 */
export const RINGS_TITLE_STEPS: readonly TitleScaleStep[] = [
  { maxLength: 12, scale: 1 },
  { maxLength: 20, scale: 0.8 },
  { maxLength: 32, scale: 0.62 },
  { maxLength: Infinity, scale: 0.5 },
];
/** 링 제목이 차지해도 되는 높이 — 나머지 줄(머리·과정·태그라인·단원·연도)과 빈 칸 몫을 남긴다 */
const RINGS_TITLE_H = 300;

/**
 * 링 제목 배율.
 * @param title - 제목
 * @returns 배율
 */
export function ringsTitleScale(title: string): number {
  const pref = titleScale(titleLengthOf(title), RINGS_TITLE_STEPS);
  return pref * fitTextScale([{ text: title, fontSize: 52 * pref, lineHeight: 1.15, width: 600 }], RINGS_TITLE_H);
}

// ---- E 스케치 — 제목 top 210px · 폭 698px(단원 격자 400px 위까지), 단원 칸 190×120px ----
/** 스케치 제목의 단계 — 12자 한 줄 */
export const SKETCH_TITLE_STEPS: readonly TitleScaleStep[] = [
  { maxLength: 12, scale: 1 },
  { maxLength: 20, scale: 0.8 },
  { maxLength: 32, scale: 0.62 },
  { maxLength: Infinity, scale: 0.5 },
];
/** 단원 격자 칸 수 — 시안의 2열 2줄(화살표 셋이 그 자리를 잇는다) */
export const SKETCH_GRID_TOPICS = 4;
/** 제목 위(210px)부터 단원 격자(400px)까지 — 제목과 과정 줄 사이 14px · 격자와의 숨 12px 를 뺀다 */
const SKETCH_HEAD_H = 400 - 210 - 14 - 12;
/** 과정 줄: mono 11px(자간 0.08em) · 폭 696px · 뿌리 줄 높이 */
const SKETCH_KICKER = { fontSize: 11, tracking: 1.08, width: 696 };

/**
 * 스케치 제목 아래 과정 줄 — 컴포넌트가 그리는 것과 같은 글이다(높이를 같은 글로 잰다).
 * @param course - 과정
 * @returns 과정 줄
 */
export function sketchKicker(course: string): string {
  return course ? `${COVER_COPY.brandKo} · ${course}` : COVER_COPY.brandKo;
}

/**
 * 스케치 제목 배율 — 과정 줄이 길어 여러 줄이면 그만큼 제목 자리가 준다(코덱스 3R).
 * @param p - 표지 값(제목·과정)
 * @returns 배율
 */
export function sketchTitleScale(p: Pick<CoverLayoutProps, 'title' | 'course'>): number {
  const kickerLines = wrappedLineCount(sketchKicker(p.course), SKETCH_KICKER.width / (SKETCH_KICKER.fontSize * SKETCH_KICKER.tracking));
  const room = SKETCH_HEAD_H - kickerLines * SKETCH_KICKER.fontSize * COVER_ROOT_LH;
  const pref = titleScale(titleLengthOf(p.title), SKETCH_TITLE_STEPS);
  return pref * fitTextScale([{ text: p.title, fontSize: 54 * pref, lineHeight: 1, width: 698 }], room);
}

/**
 * 스케치 격자에 실을 단원 — 넷을 넘으면 마지막 칸에 ` · ` 로 잇는다(격자를 늘리면 아래 큰 연도와 겹친다).
 * @param topics - 단원
 * @returns 칸마다 글
 */
export function sketchGridTopics(topics: readonly string[]): string[] {
  if (topics.length <= SKETCH_GRID_TOPICS) return [...topics];
  return [...topics.slice(0, SKETCH_GRID_TOPICS - 1), topics.slice(SKETCH_GRID_TOPICS - 1).join(' · ')];
}

/**
 * 스케치 단원 칸 배율 — 칸(폭 190px)이 두 줄 격자 높이를 넘으면 아래 큰 연도·메모와 겹친다.
 * 칸마다 크기가 다르면 들쭉날쭉하니 가장 긴 칸에 맞춘 하나를 쓴다.
 * @param grid - 칸마다 글(`sketchGridTopics`)
 * @returns 배율
 */
export function sketchTopicScale(grid: readonly string[]): number {
  return Math.min(1, ...grid.map((text) => fitTextScale([{ text, fontSize: 20, lineHeight: 1.3, width: 190 }], 120)));
}
