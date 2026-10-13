import { COVER_COPY } from './cover-copy';
import { COVER_FIT_PAGE_H, type CoverFitBudget } from './cover-fit';
import {
  fitTextScale, titleLengthOf, titleScale, wrappedLineCount, type TitleScaleStep,
} from './cover-scale';
import type { CoverLayoutProps } from './cover-text';

/**
 * D 블러의 글 크기 (순수 함수) — 제목·단원 줄이 함께 바닥 글 위에 들도록. 자리 px 는 soft.css 와 같다.
 */

// ---- D 블러 — 제목 띠 top 470px · 폭 714px, 바닥 글 bottom 40px ----
/** 블러 제목의 단계 — 7자 한 줄, 100자 다섯 줄 */
export const SOFT_TITLE_STEPS: readonly TitleScaleStep[] = [
  { maxLength: 7, scale: 1 },
  { maxLength: 12, scale: 0.8 },
  { maxLength: 20, scale: 0.6 },
  { maxLength: 32, scale: 0.45 },
  { maxLength: Infinity, scale: 0.36 },
];
/** 제목 아래 흰 글로 싣는 단원 수 — 나머지는 바닥 글에 잇는다 */
export const SOFT_BODY_TOPICS = 2;
/** 단원 줄의 배율 상한 — 짧은 제목이어도 단원 줄은 제목보다 한 단계 작다 */
const SOFT_TOPIC_MAX_SCALE = 0.8;
const SOFT_BODY_TOP = 470;
/** 태그라인(위 여백 30px + 24px) */
const SOFT_TAGLINE_H = 54;
const SOFT_FOOT_BOTTOM = 40;
/** 바닥 글 한 줄(11px × 1.6) · 폭 */
const SOFT_NOTE_LINE_H = 11 * 1.6;
const SOFT_NOTE_WIDTH = 320;
/** 이름·날짜 칸(두 줄 + 간격) */
const SOFT_FIELDS_H = 44;
/** 제목 띠와 바닥 글 사이 */
const SOFT_BREATH = 20;

/**
 * 블러의 바닥 글 줄 — 컴포넌트가 그리는 것과 같은 줄이다(높이를 같은 글로 잰다).
 * @param p - 표지 값
 * @returns 바닥 글 줄
 */
export function softFootNotes(p: CoverLayoutProps): string[] {
  const rest = p.topics.slice(SOFT_BODY_TOPICS);
  return [
    p.course ? `${COVER_COPY.brandKo} · ${p.course}` : COVER_COPY.brandKo,
    ...(p.year ? [`${p.year}${COVER_COPY.yearSuffix}`] : []),
    ...(rest.length > 0 ? [rest.join(' · ')] : []),
    COVER_COPY.softNote,
  ];
}

/**
 * 블러에서 제목·단원 줄이 함께 들어갈 자리 — 제목 띠 위(470px)부터 태그라인과 바닥 글 위까지.
 * 단원 줄은 제목보다 크지 않다(제목이 길어 작아졌는데 단원이 크면 무엇이 제목인지 뒤집힌다).
 * @param p - 표지 값
 * @returns 단계표로 고른 제목·단원 배율과, 그 크기의 글 덩어리·높이
 */
export function softBodyBudget(p: CoverLayoutProps): CoverFitBudget & { title: number; topic: number } {
  const bodyTopics = p.topics.slice(0, SOFT_BODY_TOPICS);
  const title = titleScale(titleLengthOf(p.title), SOFT_TITLE_STEPS);
  const longest = Math.max(0, ...bodyTopics.map(titleLengthOf));
  const topic = Math.min(title, SOFT_TOPIC_MAX_SCALE, titleScale(longest, SOFT_TITLE_STEPS));
  const noteLines = softFootNotes(p).reduce((n, line) => n + wrappedLineCount(line, SOFT_NOTE_WIDTH / 11), 0);
  const foot = Math.max(noteLines * SOFT_NOTE_LINE_H, p.showNameBox ? SOFT_FIELDS_H : 0);
  return {
    title,
    topic,
    blocks: [
      { text: p.title, fontSize: 84 * title, lineHeight: 0.98, width: 714 },
      ...bodyTopics.map((text) => ({ text, fontSize: 84 * topic, lineHeight: 0.98, width: 714 })),
    ],
    height: COVER_FIT_PAGE_H - SOFT_BODY_TOP - SOFT_TAGLINE_H - SOFT_FOOT_BOTTOM - foot - SOFT_BREATH,
  };
}

/**
 * 블러의 제목·단원 배율 — 둘이 **함께** 바닥 글 위에 들도록 줄인다(따로 줄이면 합이 넘친다, 코덱스 2R).
 * @param p - 표지 값
 * @returns 제목·단원 배율
 */
export function softScales(p: CoverLayoutProps): { title: number; topic: number } {
  const { blocks, height, title, topic } = softBodyBudget(p);
  const k = fitTextScale(blocks, height);
  return { title: title * k, topic: topic * k };
}

